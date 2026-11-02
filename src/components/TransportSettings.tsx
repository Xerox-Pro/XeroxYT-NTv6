import { useEffect, useState } from "react";
import { readTransportState, setTransportMode } from "../lib/apiTransport.mjs";
export default function TransportSettings() {
  const [state, setState] = useState(readTransportState);
  useEffect(() => {
    const update = () => setState(readTransportState());
    window.addEventListener("xerox-transport-changed", update);
    return () => window.removeEventListener("xerox-transport-changed", update);
  }, []);
  return (
    <section className="transport-settings">
      <label htmlFor="api-connection">APIの接続方法</label>
      <select
        id="api-connection"
        value={state.mode}
        onChange={(e) => setTransportMode(e.target.value)}
      >
        <option value="auto">自動</option>
        <option value="direct">直接接続</option>
        <option value="proxy">サーバー経由</option>
      </select>
      <p>
        {state.mode === "auto" && state.automatic
          ? "直接接続に失敗したため、サーバー経由に切り替えています。10分後に再判定します。"
          : state.mode === "auto"
            ? "直接接続を試し、失敗したらサーバー経由に切り替えます。"
            : state.mode === "direct"
              ? "API側のCORS・認証設定によっては接続できません。"
              : "サイトのサーバー経由でAPIに接続します。"}{" "}
        ログインと履歴保存は認証維持のためサーバー経由です。
      </p>
    </section>
  );
}
