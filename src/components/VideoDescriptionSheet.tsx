import { useEffect, useRef, type ReactNode } from "react";
import { X, ThumbsUp, CalendarDays, Eye } from "lucide-react";
import Avatar from "./Avatar";
import { Video } from "../types";
import { formatNumberJP } from "../utils";
export default function VideoDescriptionSheet({
  video,
  onClose,
  onSelectChannel,
  renderBody,
}: {
  video: Video;
  onClose: () => void;
  onSelectChannel: (id: string) => void;
  renderBody?: (text: string) => ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="video-description-sheet"
      aria-label="動画の概要"
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="description-sheet-inner">
        <div className="sheet-drag-handle" />
        <header className="sheet-heading">
          <h2>概要</h2>
          <button aria-label="概要欄を閉じる" onClick={onClose}>
            <X size={24} />
          </button>
        </header>
        <div className="description-sheet-scroll">
          <h3>{video.title}</h3>
          <button
            className="description-channel"
            onClick={() => {
              onClose();
              onSelectChannel(video.authorId || video.author);
            }}
          >
            <Avatar
              src={video.authorAvatar}
              name={video.author}
              channelId={video.authorId}
              className="w-9 h-9 rounded-full"
            />
            <strong>{video.author}</strong>
          </button>
          <div className="description-stats">
            <div>
              <strong>
                {video.likeCount == null
                  ? "—"
                  : formatNumberJP(video.likeCount)}
              </strong>
              <span>高評価数</span>
            </div>
            <div>
              <strong>{formatNumberJP(video.viewCount || 0)}</strong>
              <span>視聴回数</span>
            </div>
            <div>
              <strong>{video.publishedText || "—"}</strong>
              <span>公開日</span>
            </div>
          </div>
          <div className="description-full-text">
            {renderBody
              ? renderBody(video.description || "概要欄はありません。")
              : (video.description || "概要欄はありません。")
                  .split(/(https?:\/\/[^\s]+)/g)
                  .map((part, i) =>
                    /^https?:\/\//.test(part) ? (
                      <a key={i} href={part} target="_blank" rel="noreferrer">
                        {part}
                      </a>
                    ) : (
                      part
                    ),
                  )}
          </div>
          <button
            className="description-channel description-channel-large"
            onClick={() => {
              onClose();
              onSelectChannel(video.authorId || video.author);
            }}
          >
            <Avatar
              src={video.authorAvatar}
              name={video.author}
              channelId={video.authorId}
              className="w-12 h-12 rounded-full"
            />
            <span>
              <strong>{video.author}</strong>
              <small>チャンネルを表示</small>
            </span>
          </button>
          <section className="description-details">
            <h4>動画の詳細</h4>
            <p>
              <CalendarDays size={16} />
              公開日<strong>{video.publishedText || "—"}</strong>
            </p>
            <p>
              <Eye size={16} />
              視聴回数
              <strong>{(video.viewCount || 0).toLocaleString("ja-JP")}</strong>
            </p>
            <p>
              <ThumbsUp size={16} />
              高評価数
              <strong>
                {video.likeCount == null
                  ? "—"
                  : video.likeCount.toLocaleString("ja-JP")}
              </strong>
            </p>
          </section>
        </div>
      </div>
    </dialog>
  );
}
