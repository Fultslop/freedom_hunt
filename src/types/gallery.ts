export interface GalleryPhoto {
  id: string;
  kind?: "photo" | "video";
  locationId: string;
  taskTitle: string;
  teamName: string;
  uploadedAt: number;
  thumbUrl: string;
  mediumUrl: string;
  fullUrl: string;
  videoUrl?: string;
}
