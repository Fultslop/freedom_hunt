#!/usr/bin/env node
import { writeFileSync } from "fs";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  PhotonImage,
  SamplingFilter,
  resize,
} from "@cf-wasm/photon/node";
import { parseR2Key, matchPhotoToSheetRow, type SheetRow, type R2ObjectRef } from "./backfillMatching";

const PROJECT_ID = "democrats_abroad";
const CITY_ID = "den_haag";
const BUCKET_NAME = "gwc-2026-photos";
const THUMB_MAX_DIMENSION = 300;
const MEDIUM_MAX_DIMENSION = 1200;
const FULL_MAX_DIMENSION = 2048;
// get_bytes_jpeg's quality parameter is 0-100, not 0-1 — see the matching
// comment in src/worker/imageProcessing.ts for how this was verified.
const THUMB_QUALITY = 75;
const MEDIUM_QUALITY = 80;
const FULL_QUALITY = 85;

const DRY_RUN = process.argv.includes("--dry-run");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function scaledDimensions(width: number, height: number, maxDimension: number) {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function generateVariants(bytes: Uint8Array) {
  const source = PhotonImage.new_from_byteslice(bytes);
  const fullDims = scaledDimensions(source.get_width(), source.get_height(), FULL_MAX_DIMENSION);
  const fullImage = resize(source, fullDims.width, fullDims.height, SamplingFilter.Lanczos3);
  const fullBytes = fullImage.get_bytes_jpeg(FULL_QUALITY);

  const mediumDims = scaledDimensions(fullImage.get_width(), fullImage.get_height(), MEDIUM_MAX_DIMENSION);
  const mediumImage = resize(fullImage, mediumDims.width, mediumDims.height, SamplingFilter.Lanczos3);
  const mediumBytes = mediumImage.get_bytes_jpeg(MEDIUM_QUALITY);

  const thumbDims = scaledDimensions(mediumImage.get_width(), mediumImage.get_height(), THUMB_MAX_DIMENSION);
  const thumbImage = resize(mediumImage, thumbDims.width, thumbDims.height, SamplingFilter.Lanczos3);
  const thumbBytes = thumbImage.get_bytes_jpeg(THUMB_QUALITY);

  source.free();
  fullImage.free();
  mediumImage.free();
  thumbImage.free();

  return { full: fullBytes, medium: mediumBytes, thumb: thumbBytes };
}

async function fetchSheetRows(formScriptUrl: string): Promise<SheetRow[]> {
  const res = await fetch(formScriptUrl);
  const data = (await res.json()) as { ok: boolean; rows?: SheetRow[] };
  if (!data.ok || !data.rows) {
    throw new Error("Failed to read rows from FORM_SCRIPT_URL");
  }
  return data.rows;
}

async function runD1Insert(
  accountId: string,
  apiToken: string,
  photo: { id: string; teamName: string; routeId: string | null; locationId: string; contact: string | null; r2Key: string; uploadedAt: number },
) {
  const sql = `INSERT INTO photos
    (id, project_id, city_id, route_id, location_id, task_title, team_name, contact, r2_key, mime_type, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'image/jpeg', ?)`;
  const params = [
    photo.id, PROJECT_ID, CITY_ID, photo.routeId, photo.locationId,
    `Location ${photo.locationId}`, photo.teamName, photo.contact, photo.r2Key, photo.uploadedAt,
  ];
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/scavenger_hunt_auth/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  const data = (await res.json()) as { success: boolean; errors?: unknown[] };
  if (!data.success) {
    throw new Error(`D1 insert failed: ${JSON.stringify(data.errors)}`);
  }
}

async function main() {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = requireEnv("CLOUDFLARE_API_TOKEN");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  const formScriptUrl = requireEnv("FORM_SCRIPT_URL");

  const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  console.log("Fetching sheet rows...");
  const sheetRows = await fetchSheetRows(formScriptUrl);
  console.log(`Loaded ${sheetRows.length} sheet rows.`);

  console.log("Listing existing R2 objects...");
  const listResult = await s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME }));
  const objectKeys = (listResult.Contents ?? [])
    .map((obj) => obj.Key)
    .filter((key): key is string => !!key && !key.includes("/")); // skip already-migrated keys (they contain "/")

  console.log(`Found ${objectKeys.length} legacy objects to process.`);

  const report: { key: string; status: string; detail?: string }[] = [];

  const parsedRefs = objectKeys.map((key) => ({ key, ref: parseR2Key(key) }));
  parsedRefs
    .filter((entry) => !entry.ref)
    .forEach((entry) => {
      report.push({ key: entry.key, status: "skipped", detail: "key did not match expected format" });
    });
  const validRefs = parsedRefs.filter(
    (entry): entry is { key: string; ref: R2ObjectRef } => !!entry.ref,
  );

  for (const { key, ref: photoRef } of validRefs) {
    try {
      const match = matchPhotoToSheetRow(photoRef, sheetRows);
      const getResult = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      const bytes = new Uint8Array(await getResult.Body!.transformToByteArray());

      const variants = generateVariants(bytes);
      const newPrefix = `${photoRef.locationId}_${photoRef.timestamp}`;
      const photoId = crypto.randomUUID();

      if (!DRY_RUN) {
        await s3Client.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: `${newPrefix}/full.jpg`, Body: variants.full, ContentType: "image/jpeg" }));
        await s3Client.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: `${newPrefix}/medium.jpg`, Body: variants.medium, ContentType: "image/jpeg" }));
        await s3Client.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: `${newPrefix}/thumb.jpg`, Body: variants.thumb, ContentType: "image/jpeg" }));
        await runD1Insert(accountId, apiToken, {
          id: photoId,
          teamName: match.teamName,
          routeId: match.routeId,
          locationId: photoRef.locationId,
          contact: match.contact,
          r2Key: newPrefix,
          uploadedAt: Math.floor(photoRef.timestamp / 1000),
        });
      }

      report.push({ key, status: match.matched ? "migrated" : "migrated-unmatched" });
    } catch (error) {
      report.push({ key, status: "failed", detail: error instanceof Error ? error.message : String(error) });
    }
  }

  const reportPath = `backfill-report-${Date.now()}.json`;
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Done${DRY_RUN ? " (dry run, no writes performed)" : ""}. Report: ${reportPath}`);
  console.log(`  migrated: ${report.filter((r) => r.status === "migrated").length}`);
  console.log(`  migrated-unmatched: ${report.filter((r) => r.status === "migrated-unmatched").length}`);
  console.log(`  failed: ${report.filter((r) => r.status === "failed").length}`);
  console.log(`  skipped: ${report.filter((r) => r.status === "skipped").length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
