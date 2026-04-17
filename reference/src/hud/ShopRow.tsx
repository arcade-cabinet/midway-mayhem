/**
 * @module hud/ShopRow
 *
 * Single item row + preview renderers for TicketShop.
 */
import type { ShopItem } from '@/config/shopCatalog';
import { BrandButton } from '@/design/components/BrandButton';
import { color, radius, space } from '@/design/tokens';
import { typeStyle, ui } from '@/design/typography';

// ─── Preview renderers ───────────────────────────────────────────────────────

function PalettePreview({ preview }: { preview: { bg: string; dot1: string; dot2: string } }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: radius.sm,
        background: preview.bg,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: preview.dot1,
          top: 8,
          left: 8,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: preview.dot2,
          bottom: 8,
          right: 8,
        }}
      />
    </div>
  );
}

function EmojiPreview({ emoji }: { emoji: string }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        display: 'grid',
        placeItems: 'center',
        fontSize: '2rem',
        flexShrink: 0,
      }}
    >
      {emoji}
    </div>
  );
}

function renderPreview(item: ShopItem) {
  const p = item.preview;
  if ('bg' in p && 'dot1' in p)
    return <PalettePreview preview={p as { bg: string; dot1: string; dot2: string }} />;
  if ('emoji' in p) return <EmojiPreview emoji={(p as { emoji: string }).emoji} />;
  if ('color' in p) {
    return (
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: (p as { color: string }).color,
          border: `2px solid ${color.borderSubtle}`,
          flexShrink: 0,
        }}
      />
    );
  }
  if ('bg' in p && 'dot' in p) {
    const dp = p as { bg: string; dot: string };
    return (
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.xs,
          background: dp.bg,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: dp.dot }} />
      </div>
    );
  }
  return <div style={{ width: 48, height: 48 }} />;
}

// ─── Shop item row ────────────────────────────────────────────────────────────

export interface ShopRowProps {
  item: ShopItem;
  tickets: number;
  owned: boolean;
  equipped: boolean;
  onBuy: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
}

export function ShopRow({ item, tickets, owned, equipped, onBuy, onEquip }: ShopRowProps) {
  const canAfford = tickets >= item.cost;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space.md,
        padding: `${space.sm}px ${space.md}px`,
        background: equipped ? `${color.yellow}22` : 'transparent',
        border: `1px solid ${equipped ? color.yellow : color.borderSubtle}`,
        borderRadius: radius.sm,
        marginBottom: space.xs,
      }}
    >
      {renderPreview(item)}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...typeStyle(ui.label), color: color.white, fontSize: '1rem' }}>
          {item.label}
        </div>
        {!owned && (
          <div style={{ ...typeStyle(ui.body), color: color.yellow, fontSize: '0.85rem' }}>
            🎟 {item.cost} tickets
          </div>
        )}
        {owned && equipped && (
          <div style={{ ...typeStyle(ui.body), color: color.yellow, fontSize: '0.85rem' }}>
            Equipped
          </div>
        )}
        {owned && !equipped && (
          <div style={{ ...typeStyle(ui.body), color: color.dim, fontSize: '0.85rem' }}>Owned</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        {!owned ? (
          <BrandButton
            kind={canAfford ? 'primary' : 'ghost'}
            size="sm"
            disabled={!canAfford}
            onClick={() => onBuy(item)}
            testId={`shop-buy-${item.slug}`}
          >
            BUY
          </BrandButton>
        ) : equipped ? (
          <BrandButton kind="ghost" size="sm" disabled testId={`shop-equipped-${item.slug}`}>
            ✓
          </BrandButton>
        ) : (
          <BrandButton
            kind="secondary"
            size="sm"
            onClick={() => onEquip(item)}
            testId={`shop-equip-${item.slug}`}
          >
            EQUIP
          </BrandButton>
        )}
      </div>
    </div>
  );
}
