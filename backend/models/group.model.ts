import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import type { IdLike } from '../types/common.ts';

// Mobil uygulamanın grup renkleri (kurucu seçer). Eski gruplarda alan yoksa lacivert sayılır.
export const GROUP_COLORS = ['navy', 'purple', 'teal', 'orange', 'blue', 'green'] as const;
export type GroupColor = (typeof GROUP_COLORS)[number];

export interface IGroup {
  name: string;
  description: string;
  owner: Types.ObjectId;
  members: Types.ObjectId[];
  isPrivate: boolean;
  joinRequests: Types.ObjectId[];
  requestInfo: Map<string, { message: string; createdAt: Date }>;
  color: GroupColor;
  courseCode?: string;
  lastReadAt: Map<string, Date>;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface IGroupMethods {
  hasMember(userId: IdLike | undefined): boolean;
  hasPendingRequest(userId: IdLike | undefined): boolean;
}

// Dokümanda dizi alanları Mongoose dizisidir (addToSet / pull kullanılabilir).
type GroupDocumentOverrides = {
  members: Types.Array<Types.ObjectId>;
  joinRequests: Types.Array<Types.ObjectId>;
};

type GroupModel = Model<IGroup, object, IGroupMethods & GroupDocumentOverrides>;
export type GroupDocument = HydratedDocument<IGroup, IGroupMethods & GroupDocumentOverrides>;

const groupSchema = new Schema<IGroup, GroupModel, IGroupMethods>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    // Grubun kurucusu: grubu düzenleyebilir, silebilir ve üyeleri çıkarabilir. Kurucu da members içindedir.
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    // Özel grup: katılmak için kurucunun onayı gerekir; notlar, üyeler ve sohbet sadece üyelere görünür.
    isPrivate: { type: Boolean, default: false },
    // Özel gruba gönderilmiş, kurucunun onayını bekleyen katılma istekleri.
    joinRequests: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    // userId -> katılma isteğiyle yazılan kısa mesaj ve isteğin zamanı (istek kalkınca silinir).
    requestInfo: {
      type: Map,
      of: new Schema({ message: { type: String, default: '' }, createdAt: Date }, { _id: false }),
      default: {},
    },
    color: { type: String, enum: GROUP_COLORS, default: 'navy' },
    // Grubun dersi (örn. CENG213); mobilde ders filtresi ve grup ikonundaki kısa kod için.
    courseCode: { type: String, trim: true, uppercase: true, maxlength: 12 },
    // userId -> grup sohbetini en son açtığı an; bundan sonraki başkalarının mesajları "okunmamış" sayılır.
    lastReadAt: { type: Map, of: Date, default: {} },
    // Son mesaj ya da paylaşılan not zamanı: "Gruplarım" listesi buna göre sıralanır.
    lastActivityAt: { type: Date },
  },
  {
    timestamps: true,
    methods: {
      hasMember(userId) {
        return Boolean(userId) && this.members.some((id) => id.equals(userId));
      },
      hasPendingRequest(userId) {
        return Boolean(userId) && this.joinRequests.some((id) => id.equals(userId));
      },
    },
  }
);

groupSchema.index({ createdAt: -1 });

export const Group = model<IGroup, GroupModel>('Group', groupSchema);
export default Group;
