/**
 * @module components/TicketShop
 *
 * Ticket Shop overlay — mounted inside TitleScreen, opened via the "🎟 SHOP"
 * button next to START. Three tabs: Palettes / Ornaments / Horns.
 *
 * State management: reads tickets from DB each open, writes via
 * persistence/profile. On equip, dispatches to the loadout store so Cockpit
 * picks up changes immediately.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  DICE,
  HORN_SHAPES,
  HORNS,
  ORNAMENTS,
  PALETTES,
  RIMS,
  type ShopItem,
} from '@/config/shopCatalog';
import { color, elevation, radius, space, zLayer } from '@/design/tokens';
import { ui, typeStyle } from '@/design/typography';
import { BrandButton } from '@/design/components/BrandButton';
import { grantUnlock, hasUnlock, spendTickets } from '@/persistence/profile';
import { reportError } from '@/game/errorBus';
import { useLoadoutStore } from '@/hooks/useLoadout';

// ─── Tab definition ─────────────────────────────────────────────────────────

type TabId = 'palettes' | 'ornaments' | 'horns';

const TABS: { id: TabId; label: string }[] = [
  { id: 'palettes', label: '🎨 Palettes' },
  { id: 'ornaments', label: '🏵 Ornaments' },
  { id: 'horns', label: '📯 Horns' },
];

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

// ─── Shop item row ───────────────────────────────────────────────────────────

interface ShopRowProps {
  item: ShopItem;
  tickets: number;
  owned: boolean;
  equipped: boolean;
  onBuy: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
}

function ShopRow({ item, tickets, owned, equipped, onBuy, onEquip }: ShopRowProps) {
  const canAfford = tickets >= item.cost;

  const renderPreview = () => {
    const p = item.preview;
    if ('bg' in p && 'dot1' in p) return <PalettePreview preview={p as { bg: string; dot1: string; dot2: string }} />;
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
  };

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
      {renderPreview()}
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
          <div style={{ ...typeStyle(ui.body), color: color.dim, fontSize: '0.85rem' }}>
            Owned
          </div>
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

// ─── Main component ──────────────────────────────────────────────────────────

interface TicketShopProps {
  tickets: number;
  onClose: () => void;
  onTicketsChange: (n: number) => void;
}

export function TicketShop({ tickets, onClose, onTicketsChange }: TicketShopProps) {
  const [activeTab, setActiveTab] = useState<TabId>('palettes');
  const [ownedMap, setOwnedMap] = useState<Map<string, boolean>>(new Map());
  const loadout = useLoadoutStore((s) => s.loadout);
  const equip = useLoadoutStore((s) => s.equip);

  // Resolve which items are owned for the current tab
  const itemsForTab = (): ShopItem[] => {
    switch (activeTab) {
      case 'palettes': return [...PALETTES, ...RIMS, ...DICE];
      case 'ornaments': return [...ORNAMENTS, ...HORN_SHAPES];
      case 'horns': return HORNS;
    }
  };

  const refreshOwned = useCallback(async () => {
    const items = itemsForTab();
    const entries = await Promise.all(
      items.map(async (item) => {
        const owned = await hasUnlock(item.kind, item.slug).catch(() => false);
        return [item.slug, owned] as const;
      }),
    );
    setOwnedMap(new Map(entries));
  }, [activeTab]); // eslint-disable-line

  useEffect(() => {
    refreshOwned().catch((err) => reportError(err, 'TicketShop.refreshOwned'));
  }, [refreshOwned]);

  const handleBuy = async (item: ShopItem) => {
    try {
      await spendTickets(item.cost);
      await grantUnlock(item.kind, item.slug);
      onTicketsChange(tickets - item.cost);
      setOwnedMap((m) => new Map(m).set(item.slug, true));
      // Auto-equip on purchase
      await equip(item.kind, item.slug);
    } catch (err) {
      reportError(err, 'TicketShop.buy');
    }
  };

  const handleEquip = async (item: ShopItem) => {
    try {
      await equip(item.kind, item.slug);
    } catch (err) {
      reportError(err, 'TicketShop.equip');
    }
  };

  const isEquipped = (item: ShopItem): boolean => {
    if (!loadout) return false;
    switch (item.kind) {
      case 'palette': return loadout.palette === item.slug;
      case 'ornament': return loadout.ornament === item.slug;
      case 'horn': return loadout.horn === item.slug;
      case 'horn_shape': return loadout.hornShape === item.slug;
      case 'rim': return loadout.rim === item.slug;
      case 'dice': return loadout.dice === item.slug;
      default: return false;
    }
  };

  const items = itemsForTab();

  return (
    <div
      data-testid="ticket-shop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,0,15,0.92)',
        zIndex: zLayer.dialog,
        display: 'grid',
        placeItems: 'center',
        padding: space.xl,
      }}
    >
      <div
        style={{
          width: 'min(540px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: color.walnut,
          border: `3px solid ${color.yellow}`,
          borderRadius: radius.md,
          padding: space.xl,
          boxShadow: elevation.glow,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: space.lg,
          }}
        >
          <div style={{ ...typeStyle(ui.label), fontSize: '1.5rem', color: color.yellow }}>
            🎟 TICKET SHOP
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: space.md }}>
            <div style={{ ...typeStyle(ui.label), color: color.yellow }}>
              🎟 {tickets}
            </div>
            <BrandButton kind="ghost" size="sm" onClick={onClose} testId="shop-close">
              ✕
            </BrandButton>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: space.sm, marginBottom: space.base }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-testid={`shop-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: `${space.sm}px`,
                background: activeTab === tab.id ? color.purple : 'transparent',
                border: `2px solid ${activeTab === tab.id ? color.purple : color.borderSubtle}`,
                borderRadius: radius.sm,
                color: color.white,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Item list */}
        <div>
          {items.map((item) => (
            <ShopRow
              key={item.slug}
              item={item}
              tickets={tickets}
              owned={ownedMap.get(item.slug) ?? false}
              equipped={isEquipped(item)}
              onBuy={handleBuy}
              onEquip={handleEquip}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
