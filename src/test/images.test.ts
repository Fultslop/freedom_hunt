import { parseImageModules } from "../utils/images";

test("parseImageModules returns filename and url pairs for allowed extensions", () => {
  const modules: Record<string, unknown> = {
    "/src/data/img/logo.jpg": "/assets/logo-abc.jpg",
    "/src/data/img/photo.png": "/assets/photo-def.png",
    "/src/data/img/banner.webp": "/assets/banner-ghi.webp",
  };
  const result = parseImageModules(modules);
  expect(result).toHaveLength(3);
  expect(result[0]).toEqual({ filename: "logo.jpg", url: "/assets/logo-abc.jpg" });
  expect(result[1]).toEqual({ filename: "photo.png", url: "/assets/photo-def.png" });
  expect(result[2]).toEqual({ filename: "banner.webp", url: "/assets/banner-ghi.webp" });
});

test("parseImageModules excludes non-image files", () => {
  const modules: Record<string, unknown> = {
    "/src/data/img/logo.jpg": "/assets/logo.jpg",
    "/src/data/img/.gitkeep": "",
    "/src/data/img/source.svg": "/assets/source.svg",
    "/src/data/img/readme.txt": "",
  };
  const result = parseImageModules(modules);
  expect(result).toHaveLength(1);
  expect(result[0].filename).toBe("logo.jpg");
});

test("parseImageModules is case-insensitive for extensions", () => {
  const modules: Record<string, unknown> = {
    "/src/data/img/PHOTO.JPG": "/assets/PHOTO.jpg",
  };
  const result = parseImageModules(modules);
  expect(result).toHaveLength(1);
  expect(result[0].filename).toBe("PHOTO.JPG");
});
