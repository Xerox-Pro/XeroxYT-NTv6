import TransportSettings from "./TransportSettings";
import {
  useEffect,
  useRef,
  useState,
  cloneElement,
  isValidElement,
} from "react";
import {
  ArrowLeft,
  ChevronRight,
  ListVideo,
  Pencil,
  Settings,
  X,
  LogOut,
  UserRound,
  History,
  Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSiteAccount } from "./AccountGate";
import { useDeviceProfile, readProfileImage } from "../lib/deviceProfile";
import type LibraryPage from "./LibraryPage";
import type { ComponentProps } from "react";
import { formatDuration } from "../utils";
type Props = ComponentProps<typeof LibraryPage> & { children: React.ReactNode };
export default function MyPage(props: Props) {
  const profile = useDeviceProfile(),
    account = useSiteAccount(),
    navigate = useNavigate();
  const [activeList, setActiveList] = useState<string | undefined>();
  const [editing, setEditing] = useState(false),
    [library, setLibrary] = useState(false),
    [name, setName] = useState(profile.name),
    [avatar, setAvatar] = useState(profile.avatar),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editing) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editing]);
  const history = props.history.slice(0, 12);
  return (
    <div className="my-page">
      <section className="my-profile">
        <div className="my-profile-avatar">
          {profile.avatar ? (
            <img src={profile.avatar} alt="" />
          ) : (
            <UserRound size={42} />
          )}
        </div>
        <div className="my-profile-text">
          <h1>{profile.name}</h1>
          <p>@{profile.username}</p>
          <button
            onClick={() => {
              setName(profile.name);
              setAvatar(profile.avatar);
              setError("");
              setEditing(true);
            }}
          >
            <Pencil size={14} />
            プロフィールを編集
          </button>
        </div>
        <button
          className="my-settings"
          aria-label="アカウント設定"
          onClick={() => {
            setName(profile.name);
            setAvatar(profile.avatar);
            setEditing(true);
          }}
        >
          <Settings size={22} />
        </button>
      </section>
      <div className="my-account-actions">
        <button onClick={() => void account?.logout()}>
          <LogOut size={16} />
          アカウントを切り替える
        </button>
      </div>
      {!library ? (
        <>
          <section className="my-section">
            <div className="my-section-heading">
              <h2>履歴</h2>
              <button onClick={props.onNavigateToHistory}>
                すべて表示
                <ChevronRight size={16} />
              </button>
            </div>
            {history.length ? (
              <div className="my-horizontal-list">
                {history.map((v, i) => (
                  <button
                    className="my-video-card"
                    key={`${v.videoId}-${i}`}
                    onClick={() =>
                      v.type === "short"
                        ? navigate(`/shorts/${v.videoId}`)
                        : props.onVideoSelect(v.videoId!)
                    }
                  >
                    <div className="my-card-image">
                      <img
                        src={
                          v.thumbnailUrl ||
                          `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
                        }
                        alt=""
                        loading="lazy"
                      />
                      {v.type === "short" ? (
                        <span>ショート</span>
                      ) : (
                        <span>{formatDuration(v.lengthSeconds || 0)}</span>
                      )}
                    </div>
                    <h3>{v.title}</h3>
                    <p>{v.author}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="my-empty">
                <History size={26} />
                <p>視聴した動画がここに表示されます</p>
              </div>
            )}
          </section>
          <section className="my-section">
            <div className="my-section-heading">
              <h2>再生リスト</h2>
              <button onClick={() => setLibrary(true)}>
                すべて表示
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="my-horizontal-list">
              {props.playlists.map((pl) => (
                <button
                  className="my-video-card my-playlist-card"
                  key={pl.id}
                  onClick={() => {
                    setActiveList(pl.id);
                    setLibrary(true);
                  }}
                >
                  <div className="my-card-image">
                    {pl.videos[0]?.videoThumbnails?.[0]?.url ? (
                      <img
                        src={pl.videos[0].videoThumbnails[0].url}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <ListVideo size={32} />
                    )}
                    <span>
                      <ListVideo size={14} />
                      {pl.videos.length}本の動画
                    </span>
                  </div>
                  <h3>{pl.title}</h3>
                  <p>この端末の再生リスト</p>
                </button>
              ))}
              <button
                className="my-create-playlist"
                onClick={() => setLibrary(true)}
              >
                <Plus size={25} />
                <strong>再生リストを作成・管理</strong>
              </button>
            </div>
          </section>
        </>
      ) : (
        <section className="my-library-editor">
          <button className="my-back" onClick={() => setLibrary(false)}>
            <ArrowLeft size={18} />
            マイページに戻る
          </button>
          {isValidElement<{ initialPlaylistId?: string }>(props.children)
            ? cloneElement(props.children, {
                initialPlaylistId: activeList,
                key: activeList,
              })
            : props.children}
        </section>
      )}
      <TransportSettings />
      <dialog
        ref={dialog}
        className="profile-dialog"
        onCancel={() => setEditing(false)}
        onClose={() => setEditing(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              profile.save({ name, avatar });
              setEditing(false);
            } catch {
              setError("端末に保存できません。保存領域を確認してください。");
            }
          }}
        >
          <div className="sheet-heading">
            <h2>プロフィールを編集</h2>
            <button
              type="button"
              aria-label="閉じる"
              onClick={() => setEditing(false)}
            >
              <X />
            </button>
          </div>
          <p>
            変更した名前とアイコンは、この端末・このブラウザーだけに保存されます。ログイン名は変わりません。
          </p>
          <label className="profile-image-picker">
            {avatar ? (
              <img src={avatar} alt="選択したアイコン" />
            ) : (
              <UserRound size={40} />
            )}
            <span>画像を変更</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file)
                  try {
                    setAvatar(await readProfileImage(file));
                    setError("");
                  } catch (err) {
                    setError(String((err as Error).message));
                  }
              }}
            />
          </label>
          <label className="profile-name-label">
            表示名
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <div className="profile-dialog-actions">
            <button
              type="button"
              onClick={() => {
                setName(profile.username);
                setAvatar("");
              }}
            >
              元に戻す
            </button>
            <button type="submit">保存</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
