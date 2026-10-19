import type {
  AttachmentDto,
  PublicAttachmentDto,
  ShareDto,
} from "../contracts/share";
import type { Attachment, Share } from "../db/schema";

export function toShareDto(share: Share): ShareDto {
  return {
    targetType: share.shareableType,
    targetId: share.shareableId,
    token: share.token,
    createdAt: share.createdAt,
  };
}

export function toAttachmentDto(attachment: Attachment): AttachmentDto {
  return {
    id: attachment.id,
    targetType: attachment.attachableType,
    targetId: attachment.attachableId,
    name: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: attachment.createdAt,
  };
}

export function toPublicAttachmentDto(attachment: Attachment): PublicAttachmentDto {
  return {
    id: attachment.id,
    name: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: attachment.createdAt,
  };
}
