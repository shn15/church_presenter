import mqtt, { MqttClient } from "mqtt";
import { Slide, Shift } from "../types";
import {
  extractMediaPath,
  findMediaByUrl,
  saveMedia,
} from "./indexedDbMedia";

export interface SyncedSettings {
  outputResolution?: string;
  transitionDuration?: number;
  globalFontFamily?: string;
  globalTextTransform?: string;
  lowerThirdMode?: boolean;
  globalFontSizeScale?: number;
  globalTextShadowStyle?: string;
  chromaKeyColor?: string;
  cameraBgEnabled?: boolean;
  cameraBgDeviceId?: string;
  cameraBgLabel?: string;
  cameraBgMirror?: boolean;
  cameraBgBrightness?: number;
  cameraBgOpacity?: number;
  cameraBgBlur?: number;
  cameraBgFit?: "cover" | "contain";
  _syncTs?: number;
  _syncSession?: string;
}

const MQTT_BROKERS = [
  "wss://broker.emqx.io:8884/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
];

function hashString(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function getSyncRoomId(accountId: string): string {
  const safeAcc = (accountId || "acc_default").replace(/[^a-zA-Z0-9_-]/g, "");
  if (typeof window === "undefined") return `cp-${safeAcc}`;

  try {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get("room");
    if (urlRoom && urlRoom.trim()) {
      const cleanRoom = urlRoom.trim();
      localStorage.setItem(`cp_sync_room_${safeAcc}`, cleanRoom);
      sessionStorage.setItem(`cp_sync_room_${safeAcc}`, cleanRoom);
      return cleanRoom;
    }

    const stored =
      sessionStorage.getItem(`cp_sync_room_${safeAcc}`) ||
      localStorage.getItem(`cp_sync_room_${safeAcc}`);
    if (stored && stored.trim()) {
      return stored.trim();
    }

    const generated = `cp-${safeAcc}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(`cp_sync_room_${safeAcc}`, generated);
    return generated;
  } catch {
    return `cp-${safeAcc}`;
  }
}

export function isLocalOrUploadMedia(url?: string): boolean {
  if (!url) return false;
  return url.includes("/local-media/") || url.includes("/uploads/");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize))
    );
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface OperatorStatus {
  active: boolean;
  isLive: boolean;
  ts: number;
  senderId?: string;
  replyTo?: string;
}

interface CloudSyncCallbacks {
  onSlide?: (slide: Slide, ts: number) => void;
  onShift?: (shift: Shift, ts: number) => void;
  onSettings?: (settings: SyncedSettings, ts: number) => void;
  onOperatorStatus?: (status: OperatorStatus) => void;
  onMediaReceived?: (mediaPath: string) => void;
}

export class CloudSyncClient {
  private roomId: string;
  private client: MqttClient | null = null;
  private clientId: string;
  private brokerIndex = 0;
  private destroyed = false;
  private callbacks: CloudSyncCallbacks;
  private isOperatorMode: boolean;

  private lastSlideTs = 0;
  private lastShiftTs = 0;
  private lastSettingsTs = 0;
  private lastStatusTs = 0;
  private subscribedAt = 0;
  private lastPingId = "";
  private lastActiveSenderId = "";
  private currentStatus: OperatorStatus | null = null;
  private lastPublishedSlide: Slide | null = null;
  private lastPublishedSettings: SyncedSettings | null = null;
  private lastPublishedShift: Shift | null = null;

  private requestedMedia = new Map<string, number>();
  private queuedMediaRequests = new Set<string>();
  private incomingChunks = new Map<
    string,
    {
      path: string;
      name: string;
      mime: string;
      mediaKind: "image" | "video";
      total: number;
      chunks: Map<number, string>;
    }
  >();
  private peerConnections = new Map<string, RTCPeerConnection>();

  constructor(
    roomId: string,
    isOperatorMode: boolean,
    callbacks: CloudSyncCallbacks
  ) {
    this.roomId = roomId;
    this.isOperatorMode = isOperatorMode;
    this.callbacks = callbacks;
    this.clientId = `u_${Math.random().toString(36).slice(2, 9)}`;
    this.connect();
  }

  private get prefix() {
    return `churchpresenter/v2/${this.roomId}`;
  }

  private connect() {
    if (this.destroyed || typeof window === "undefined") return;
    const brokerUrl = MQTT_BROKERS[this.brokerIndex % MQTT_BROKERS.length];

    try {
      const client = mqtt.connect(brokerUrl, {
        clientId: `${this.clientId}_${Date.now().toString(36)}`,
        clean: true,
        reconnectPeriod: 4000,
        connectTimeout: 8000,
        keepalive: 20,
        ...(this.isOperatorMode
          ? {
              will: {
                topic: `${this.prefix}/status`,
                payload: JSON.stringify({
                  active: false,
                  isLive: false,
                  ts: Date.now(),
                  senderId: this.clientId,
                }),
                qos: 1,
                retain: true,
              },
            }
          : {}),
      });

      this.client = client;

      const fallbackTimer = window.setTimeout(() => {
        if (!client.connected && !this.destroyed) {
          try {
            client.end(true);
          } catch {}
          this.brokerIndex += 1;
          this.connect();
        }
      }, 6500);

      client.on("connect", () => {
        window.clearTimeout(fallbackTimer);
        const topics = [
          `${this.prefix}/slide`,
          `${this.prefix}/shift`,
          `${this.prefix}/settings`,
          `${this.prefix}/status`,
          `${this.prefix}/media-chunk/+`,
          `${this.prefix}/webrtc/${this.clientId}`,
        ];
        if (this.isOperatorMode) {
          topics.push(`${this.prefix}/media-req`);
          topics.push(`${this.prefix}/ping`);
        }
        client.subscribe(topics, { qos: 1 }, () => {
          this.subscribedAt = Date.now();
          if (this.isOperatorMode && this.currentStatus) {
            this.publishOperatorStatus(this.currentStatus);
          } else if (!this.isOperatorMode) {
            this.pingOperator();
          }
          if (this.queuedMediaRequests.size > 0) {
            const pending = Array.from(this.queuedMediaRequests);
            this.queuedMediaRequests.clear();
            pending.forEach((u) => this.requestMediaTransfer(u));
          }
        });
      });

      client.on("message", (topic, payload) => {
        if (this.destroyed) return;
        try {
          const text = new TextDecoder().decode(payload);
          const data = JSON.parse(text);
          this.handleMessage(topic, data);
        } catch {}
      });

      client.on("error", () => {
        // Fallback handled automatically by reconnectPeriod / timeout
      });
    } catch {
      this.brokerIndex += 1;
    }
  }

  private async handleMessage(topic: string, data: any) {
    const p = this.prefix;

    if (topic === `${p}/slide` && data?.slide) {
      const ts = typeof data.ts === "number" ? data.ts : Date.now();
      if (ts >= this.lastSlideTs && data.senderId !== this.clientId) {
        this.lastSlideTs = ts;
        this.callbacks.onSlide?.(data.slide, ts);
      }
      return;
    }

    if (topic === `${p}/shift` && data?.shift) {
      const ts = typeof data.ts === "number" ? data.ts : Date.now();
      if (ts >= this.lastShiftTs && data.senderId !== this.clientId) {
        this.lastShiftTs = ts;
        this.callbacks.onShift?.(data.shift, ts);
      }
      return;
    }

    if (topic === `${p}/settings` && data?.settings) {
      const ts = typeof data.ts === "number" ? data.ts : Date.now();
      if (ts >= this.lastSettingsTs && data.senderId !== this.clientId) {
        this.lastSettingsTs = ts;
        this.callbacks.onSettings?.(data.settings, ts);
      }
      return;
    }

    if (topic === `${p}/status` && data && typeof data.active === "boolean") {
      if (data.senderId === this.clientId) return;
      const ts = typeof data.ts === "number" ? data.ts : Date.now();
      const isDirectReply = Boolean(data.replyTo && data.replyTo === this.lastPingId);
      const isLivePushAfterSubscribe =
        this.subscribedAt > 0 && Date.now() - this.subscribedAt > 1500;
      const senderChanged = Boolean(data.senderId && data.senderId !== this.lastActiveSenderId);

      // Ignore initial retained flush (both active and stale offline LWT) unless it's a direct ping reply
      // or a live update arriving after the initial retained flush window.
      if (isDirectReply || isLivePushAfterSubscribe) {
        if (data.active && data.senderId) {
          this.lastActiveSenderId = data.senderId;
        }
        if (ts >= this.lastStatusTs || isDirectReply || (data.active && senderChanged)) {
          this.lastStatusTs = ts;
          this.callbacks.onOperatorStatus?.({
            active: Boolean(data.active),
            isLive: data.isLive !== false,
            ts,
            senderId: data.senderId,
            replyTo: data.replyTo,
          });
        }
      }
      return;
    }

    if (topic === `${p}/ping` && this.isOperatorMode) {
      if (this.currentStatus) {
        this.publishOperatorStatus(
          {
            active: this.currentStatus.active,
            isLive: this.currentStatus.isLive,
          },
          data?.pingId
        );
        if (this.lastPublishedSettings) {
          this.publishSettings(this.lastPublishedSettings);
        }
        if (this.lastPublishedShift) {
          this.publishShift(this.lastPublishedShift);
        }
        if (this.currentStatus.active && this.lastPublishedSlide) {
          this.publishSlide(this.lastPublishedSlide);
        }
      }
      return;
    }

    if (topic === `${p}/media-req` && this.isOperatorMode && data?.url) {
      if (data.requesterId === this.clientId) return;
      await this.serveMediaRequest(data);
      return;
    }

    if (topic.startsWith(`${p}/media-chunk/`)) {
      if (data?.senderId === this.clientId) return;
      await this.handleMediaChunk(data);
      return;
    }

    if (topic === `${p}/webrtc/${this.clientId}`) {
      await this.handleWebRtcSignal(data);
    }
  }

  public publishOperatorStatus(
    status: { active: boolean; isLive: boolean },
    replyTo?: string
  ) {
    const ts = Date.now();
    this.lastStatusTs = ts;
    const payload: OperatorStatus = {
      active: status.active,
      isLive: status.isLive,
      ts,
      senderId: this.clientId,
      ...(replyTo ? { replyTo } : {}),
    };
    this.currentStatus = payload;
    if (this.client?.connected) {
      this.client.publish(
        `${this.prefix}/status`,
        JSON.stringify(payload),
        { qos: status.active ? 1 : 0, retain: true }
      );
    }
  }

  public pingOperator() {
    if (this.client?.connected) {
      const pingId = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      this.lastPingId = pingId;
      this.client.publish(
        `${this.prefix}/ping`,
        JSON.stringify({ requesterId: this.clientId, pingId, ts: Date.now() }),
        { qos: 0 }
      );
    }
  }

  public publishSlide(slide: Slide) {
    const ts = Date.now();
    this.lastSlideTs = ts;
    this.lastPublishedSlide = slide;
    if (this.client?.connected) {
      this.client.publish(
        `${this.prefix}/slide`,
        JSON.stringify({ slide, ts, senderId: this.clientId }),
        { qos: 1, retain: true }
      );
    }
  }

  public publishShift(shift: Shift) {
    const ts = Date.now();
    this.lastShiftTs = ts;
    this.lastPublishedShift = shift;
    if (this.client?.connected) {
      this.client.publish(
        `${this.prefix}/shift`,
        JSON.stringify({ shift, ts, senderId: this.clientId }),
        { qos: 1, retain: true }
      );
    }
  }

  public publishSettings(settings: SyncedSettings) {
    const ts = Date.now();
    this.lastSettingsTs = ts;
    this.lastPublishedSettings = settings;
    if (this.client?.connected) {
      this.client.publish(
        `${this.prefix}/settings`,
        JSON.stringify({ settings, ts, senderId: this.clientId }),
        { qos: 1, retain: true }
      );
    }
  }

  public requestMediaTransfer(url: string) {
    if (!url) return;
    const cleanPath = extractMediaPath(url);
    if (!isLocalOrUploadMedia(cleanPath) && !cleanPath.includes("/backgrounds/")) return;

    if (!this.client?.connected) {
      this.queuedMediaRequests.add(cleanPath);
      return;
    }

    const lastReq = this.requestedMedia.get(cleanPath) || 0;
    if (Date.now() - lastReq < 15000) return;

    this.requestedMedia.set(cleanPath, Date.now());
    const requestId = `req_${hashString(cleanPath)}_${this.clientId}`;

    this.client.publish(
      `${this.prefix}/media-req`,
      JSON.stringify({
        requestId,
        url,
        path: cleanPath,
        requesterId: this.clientId,
      }),
      { qos: 1 }
    );
  }

  private async serveMediaRequest(req: {
    requestId: string;
    url: string;
    path: string;
    requesterId: string;
  }) {
    if (!this.client?.connected) return;
    const cleanPath = extractMediaPath(req.path || req.url);
    let item = await findMediaByUrl(cleanPath);
    if ((!item || !item.file) && cleanPath.startsWith("/backgrounds/") && typeof fetch !== "undefined") {
      try {
        const res = await fetch(cleanPath);
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 0) {
            const filename = cleanPath.split("/").pop() || "media";
            const isVidFallback = blob.type.startsWith("video/") || /\.(mp4|webm|ogg|mov|m4v)$/i.test(filename);
            item = {
              id: cleanPath,
              file: blob,
              name: filename,
              type: blob.type || (isVidFallback ? "video/mp4" : "image/jpeg"),
              mediaKind: isVidFallback ? "video" : "image",
              timestamp: Date.now(),
            };
          }
        }
      } catch {}
    }
    if (!item || !item.file) return;

    const isVid =
      item.mediaKind === "video" ||
      item.type?.startsWith("video/") ||
      /\.(mp4|webm|ogg|mov|m4v)$/i.test(item.name || cleanPath);
    const mediaKind: "image" | "video" = isVid ? "video" : "image";

    const fileSize = item.file.size || 0;
    if (fileSize <= 6 * 1024 * 1024) {
      try {
        const buffer = await item.file.arrayBuffer();
        const b64 = arrayBufferToBase64(buffer);
        const chunkLen = 48000;
        const total = Math.ceil(b64.length / chunkLen);
        for (let i = 0; i < total; i++) {
          if (this.destroyed || !this.client?.connected) break;
          this.client.publish(
            `${this.prefix}/media-chunk/${req.requestId}`,
            JSON.stringify({
              requestId: req.requestId,
              path: cleanPath,
              name: item.name,
              mime: item.type || (isVid ? "video/mp4" : "image/jpeg"),
              mediaKind,
              index: i,
              total,
              chunk: b64.slice(i * chunkLen, (i + 1) * chunkLen),
              senderId: this.clientId,
            }),
            { qos: 1 }
          );
          if (i % 5 === 4) {
            await new Promise((r) => setTimeout(r, 35));
          }
        }
        return;
      } catch {}
    }

    if (typeof RTCPeerConnection !== "undefined") {
      void this.sendBinaryViaWebRTC(req.requestId, req.requesterId, cleanPath, item, mediaKind);
    }
  }

  private async handleMediaChunk(data: any) {
    const { requestId, path, name, mime, mediaKind, index, total, chunk } = data;
    if (!requestId || typeof index !== "number" || typeof total !== "number" || !chunk) {
      return;
    }

    let entry = this.incomingChunks.get(requestId);
    if (!entry) {
      entry = {
        path,
        name: name || path.split("/").pop() || "media",
        mime: mime || "application/octet-stream",
        mediaKind: mediaKind || "video",
        total,
        chunks: new Map(),
      };
      this.incomingChunks.set(requestId, entry);
    }

    entry.chunks.set(index, chunk);
    if (entry.chunks.size === entry.total) {
      this.incomingChunks.delete(requestId);
      const parts: string[] = [];
      for (let i = 0; i < entry.total; i++) {
        parts.push(entry.chunks.get(i) || "");
      }
      const bytes = base64ToUint8Array(parts.join(""));
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: entry.mime });
      const cleanPath = extractMediaPath(entry.path);
      await saveMedia(cleanPath, blob, entry.name, entry.mime, {
        mediaKind: entry.mediaKind,
      });
      this.callbacks.onMediaReceived?.(cleanPath);
    }
  }

  private async sendBinaryViaWebRTC(
    requestId: string,
    targetPeerId: string,
    cleanPath: string,
    item: { file: Blob; name: string; type: string },
    mediaKind: "image" | "video"
  ) {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      this.peerConnections.set(requestId, pc);

      const dc = pc.createDataChannel("media");
      dc.binaryType = "arraybuffer";

      dc.onopen = async () => {
        try {
          dc.send(
            JSON.stringify({
              meta: true,
              path: cleanPath,
              name: item.name,
              mime: item.type || (mediaKind === "video" ? "video/mp4" : "image/jpeg"),
              mediaKind,
              size: item.file.size,
            })
          );
          const buffer = await item.file.arrayBuffer();
          const sliceSize = 32768;
          for (let offset = 0; offset < buffer.byteLength; offset += sliceSize) {
            while (dc.bufferedAmount > 512 * 1024) {
              await new Promise((r) => setTimeout(r, 30));
            }
            if (dc.readyState !== "open") break;
            dc.send(buffer.slice(offset, offset + sliceSize));
          }
          if (dc.readyState === "open") {
            dc.send(JSON.stringify({ done: true }));
          }
        } catch {}
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate && this.client?.connected) {
          this.client.publish(
            `${this.prefix}/webrtc/${targetPeerId}`,
            JSON.stringify({
              type: "ice",
              requestId,
              fromId: this.clientId,
              candidate: ev.candidate,
            })
          );
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.client?.publish(
        `${this.prefix}/webrtc/${targetPeerId}`,
        JSON.stringify({
          type: "offer",
          requestId,
          fromId: this.clientId,
          sdp: offer,
        })
      );
    } catch {}
  }

  private async handleWebRtcSignal(data: any) {
    if (typeof RTCPeerConnection === "undefined") return;
    const { type, requestId, fromId, sdp, candidate } = data;
    if (!requestId) return;

    try {
      if (type === "offer" && sdp) {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        this.peerConnections.set(requestId, pc);

        pc.ondatachannel = (ev) => {
          const dc = ev.channel;
          dc.binaryType = "arraybuffer";
          let meta: { path: string; name: string; mime: string; mediaKind?: "image" | "video" } | null = null;
          const buffers: ArrayBuffer[] = [];

          dc.onmessage = async (msg) => {
            if (typeof msg.data === "string") {
              try {
                const parsed = JSON.parse(msg.data);
                if (parsed.meta) {
                  meta = parsed;
                } else if (parsed.done && meta) {
                  const blob = new Blob(buffers, { type: meta.mime || "application/octet-stream" });
                  const cleanPath = extractMediaPath(meta.path);
                  await saveMedia(cleanPath, blob, meta.name, meta.mime || "application/octet-stream", {
                    mediaKind: meta.mediaKind || "video",
                  });
                  this.callbacks.onMediaReceived?.(cleanPath);
                  try {
                    pc.close();
                  } catch {}
                  this.peerConnections.delete(requestId);
                }
              } catch {}
            } else if (msg.data instanceof ArrayBuffer) {
              buffers.push(msg.data);
            }
          };
        };

        pc.onicecandidate = (ev) => {
          if (ev.candidate && this.client?.connected) {
            this.client.publish(
              `${this.prefix}/webrtc/${fromId}`,
              JSON.stringify({
                type: "ice",
                requestId,
                fromId: this.clientId,
                candidate: ev.candidate,
              })
            );
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.client?.publish(
          `${this.prefix}/webrtc/${fromId}`,
          JSON.stringify({
            type: "answer",
            requestId,
            fromId: this.clientId,
            sdp: answer,
          })
        );
      } else if (type === "answer" && sdp) {
        const pc = this.peerConnections.get(requestId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      } else if (type === "ice" && candidate) {
        const pc = this.peerConnections.get(requestId);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    } catch {}
  }

  public destroy() {
    if (this.isOperatorMode && this.client?.connected) {
      try {
        this.client.publish(
          `${this.prefix}/status`,
          JSON.stringify({
            active: false,
            isLive: false,
            ts: Date.now(),
            senderId: this.clientId,
          }),
          { qos: 0, retain: true }
        );
      } catch {}
    }
    this.destroyed = true;
    for (const pc of this.peerConnections.values()) {
      try {
        pc.close();
      } catch {}
    }
    this.peerConnections.clear();
    try {
      this.client?.end(false);
    } catch {}
    this.client = null;
  }
}
