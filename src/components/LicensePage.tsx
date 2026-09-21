import React, { useState } from 'react';
import { 
  ScrollText, 
  User, 
  Copy, 
  Check, 
  ShieldAlert, 
  Code2, 
  Tv, 
  Share2, 
  Ban, 
  ArrowLeft,
  Users,
  Info
} from 'lucide-react';

interface LicensePageProps {
  onBack?: () => void;
}

export default function LicensePage({ onBack }: LicensePageProps) {
  const [copiedKeyUrl, setCopiedKeyUrl] = useState(false);
  const eduKeyUrl = 'https://raw.githubusercontent.com/wista-api-project/auto/refs/heads/main/edu/1.txt';

  const handleCopy = () => {
    navigator.clipboard.writeText(eduKeyUrl);
    setCopiedKeyUrl(true);
    setTimeout(() => setCopiedKeyUrl(false), 2000);
  };

  const licenseRules = [
    {
      icon: Ban,
      title: '商用利用は禁止',
      description: '本ソフトウェアおよびAPIの営利目的での販売・有料サービスへの組み込み・商用利用は固く禁止されています。',
      status: '❌ 商用利用禁止',
      accent: 'text-amber-800 bg-amber-50/80',
    },
    {
      icon: Tv,
      title: '広告付きサイトでの利用は条件付きで許可',
      description: '個人の非商用サイトなど、一定の限定的な運用条件下においてのみ例外的に許可されます。',
      status: '📺 広告付きサイト条件付き許可',
      accent: 'text-sky-800 bg-sky-50/70',
    },
    {
      icon: Code2,
      title: '改変・再配布時はソースコードの完全公開が必要',
      description: 'ソースコードを改変・派生させて再配布する場合、例外なくソースコードの完全公開が義務付けられます。',
      status: '🔓 ソースコード完全公開必須',
      accent: 'text-indigo-800 bg-indigo-50/70',
    },
    {
      icon: Share2,
      title: '再配布は同じライセンスのもとで許可',
      description: '派生版や再配布物は、必ず本ライセンス（Wista API License V1）と同一のライセンスのもとでのみ配布可能です。',
      status: '📦 同一ライセンス継承',
      accent: 'text-emerald-800 bg-emerald-50/70',
    },
    {
      icon: User,
      title: '「woolisbest」のクレジット表記が必須',
      description: 'README・アプリ内UI・貢献者（Contributors）の3箇所すべてに「woolisbest」のクレジット表記が必須です。',
      status: '👤 クレジット表記必須',
      accent: 'text-blue-900 bg-blue-50/80',
      highlight: true,
    },
    {
      icon: ShieldAlert,
      title: '追加の制限を課すことは禁止',
      description: '本ライセンスが利用者に付与する権利以上の追加条件や独自制限を課すことは固く禁止されています。',
      status: '🚫 追加制限禁止',
      accent: 'text-stone-700 bg-stone-100/70',
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#2d3748] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* 上部ナビゲーション */}
        {onBack && (
          <button
            onClick={onBack}
            className="mb-8 inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[#4a5568] hover:text-[#1a202c] transition-colors duration-200 cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>ホームへ戻る</span>
          </button>
        )}

        {/* 免責・製作者確認バナー */}
        <div className="mb-8 p-4 bg-amber-50/70 rounded-xl border border-amber-200/60 flex items-start gap-3">
          <Info size={18} className="text-amber-800 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-amber-950 leading-[1.6]">
            <span className="font-semibold block mb-0.5">製作者に関する重要なお知らせ</span>
            本サイトの運用者・配布者は本ソフトウェアの製作者ではありません。本ソフトウェアおよび組み込まれているAPI機能の<strong>原作者・製作者は「woolisbest」</strong>です。Wista API License V1 の規定に基づき、製作者のクレジットをここに明記しています。
          </div>
        </div>

        {/* ヘッダーエリア */}
        <header className="mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100/80 rounded-full text-xs font-medium text-gray-700 mb-4 tracking-wide">
            <ScrollText size={14} className="text-gray-600" />
            <span>Wista API License V1</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1a202c] mb-3 leading-snug">
            製作者クレジット & ライセンス
          </h1>
          <p className="text-[#4a5568] text-sm sm:text-base leading-[1.7] tracking-[0.01em]">
            このプロジェクトは <span className="font-semibold text-[#1a202c]">Wista API License V1</span> のもとで公開されており、製作者 <span className="font-semibold text-[#1a202c]">woolisbest</span> により設計・提供されています。
          </p>
        </header>

        {/* 製作者クレジット カード */}
        <section className="mb-10 sm:mb-12 bg-white rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-gray-400">Original Author & Creator</span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#1a202c] mt-0.5 tracking-tight flex items-center gap-2">
                woolisbest
                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-800 rounded-md">
                  原作者・製作者
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Wista API Project 創設者 / システム設計者
              </p>
            </div>
            <div className="text-xs text-gray-600 bg-gray-50 px-3.5 py-2.5 rounded-lg leading-relaxed sm:text-right border border-gray-100">
              <span className="block font-semibold text-gray-800">クレジット表記義務</span>
              「woolisbest」の表記必須（README・アプリ内・貢献者）
            </div>
          </div>

          {/* 貢献者 (Contributors) */}
          <div className="mt-6 pb-6 border-b border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
              <Users size={14} className="text-gray-500" />
              貢献者 (Contributors)
            </h3>
            <div className="flex items-center gap-3 bg-[#f8fafc] p-3.5 rounded-lg border border-gray-100">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                W
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  woolisbest
                  <span className="text-[11px] font-normal text-blue-700 bg-blue-50 px-2 py-0.2 rounded">
                    原作者・コア開発
                  </span>
                </div>
                <div className="text-xs text-gray-500 truncate mt-0.5">
                  Wista API / 自動edu key同期システム開発
                </div>
              </div>
            </div>
          </div>

          {/* edu key 取得先 */}
          <div className="mt-6 pt-1">
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              edu key 取得先エンドポイント
            </label>
            <div className="flex items-center gap-2 bg-[#f8fafc] p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm font-mono text-gray-800 break-all border border-gray-100">
              <span className="flex-1 select-all">{eduKeyUrl}</span>
              <button
                onClick={handleCopy}
                className="shrink-0 p-2 text-gray-600 hover:text-gray-900 bg-white rounded-md shadow-2xs hover:shadow-xs transition-all duration-200 active:scale-[0.96] cursor-pointer border border-gray-100"
                title="URLをコピー"
              >
                {copiedKeyUrl ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-gray-400 leading-normal">
              YouTube Education 埋め込みプレイヤー用の最新パラメータを提供する公式 Wista API ソースです。
            </p>
          </div>
        </section>

        {/* 📜 ライセンス概要（日本語） */}
        <section className="mb-10 sm:mb-12">
          <div className="mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-[#1a202c] tracking-tight">
              📜 ライセンス概要（日本語）
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed">
              このプロジェクトは Wista API License V1 のもとで公開されています。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            {licenseRules.map((rule, idx) => {
              const Icon = rule.icon;
              return (
                <div
                  key={idx}
                  className={`bg-white p-5 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100/80 transition-all duration-200 ${
                    rule.highlight ? 'ring-1 ring-blue-500/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${rule.accent}`}>
                      <Icon size={13} />
                      {rule.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#1a202c] mb-1.5 leading-snug">
                    {rule.title}
                  </h3>
                  <p className="text-xs text-[#4a5568] leading-[1.65]">
                    {rule.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ライセンス条項詳細 */}
        <section className="bg-white rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-100/80 mb-12">
          <h3 className="text-base font-bold text-[#1a202c] mb-4 tracking-tight">
            Wista API License V1 規定条項
          </h3>
          <div className="space-y-4 text-xs sm:text-sm text-[#4a5568] leading-[1.75]">
            <p>
              本ソフトウェアは製作者 <strong>woolisbest</strong> により公開されたプロジェクトです。いかなる再配布・改変・利用時も以下のルールを厳格に遵守する必要があります。
            </p>
            <div className="bg-[#f8fafc] p-4 sm:p-5 rounded-lg space-y-2.5 text-xs text-gray-800 leading-relaxed border border-gray-100">
              <div className="flex items-start gap-2">
                <span className="font-bold text-amber-700 shrink-0">❌ 商用利用は禁止:</span>
                <span>営利目的での販売、有料プランへの組み込み、有料サービスとしての運用は固く禁止されています。</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-sky-800 shrink-0">📺 広告付きサイトでの利用:</span>
                <span>個人の非商用サイトなど、一定の限定的な条件下においてのみ許可されます。</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-indigo-800 shrink-0">🔓 完全公開義務:</span>
                <span>改変・再配布時はソースコードの完全公開が必須となります。非公開での改変配布は認められません。</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-emerald-800 shrink-0">📦 再配布条件:</span>
                <span>再配布物は例外なく同じライセンス（Wista API License V1）のもとで公開される必要があります。</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-blue-900 shrink-0">👤 クレジット表記必須:</span>
                <span>「woolisbest」のクレジット表記が必須（README・アプリ内・貢献者）です。</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-stone-700 shrink-0">🚫 追加制限禁止:</span>
                <span>受領者に対して本ライセンス以上の追加条件や権利制限を課すことは禁止されています。</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 pt-2">
              ※本ソフトウェアの利用者および再配布者は、製作者を詐称することなく、原作者である <strong>woolisbest</strong> の権利とクレジット表記を保護する責任を負います。
            </p>
          </div>
        </section>

        {/* フッター */}
        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100">
          <p>XeroxYT-NTv6 • Wista API Project • 製作者: <strong className="text-gray-600 font-semibold">woolisbest</strong></p>
        </footer>
      </div>
    </div>
  );
}
