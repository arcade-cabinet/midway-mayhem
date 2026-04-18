/**
 * @module ui/panels/TicketShop
 *
 * Ticket Shop overlay — mounted inside TitleScreen, opened via the "🎟 SHOP"
 * button next to START. Three tabs: Palettes / Ornaments / Horns.
 *
 * State management: reads tickets from DB each open, writes via
 * persistence/profile. On equip, dispatches to the loadout store so Cockpit
 * picks up changes immediately.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DICE,
  HORN_SHAPES,
  HORNS,
  ORNAMENTS,
  PALETTES,
  RIMS,
  type ShopItem,
} from '@/config/shopCatalog';
import { BrandButton } from '@/design/components/BrandButton';
import { color, elevation, radius, space, zLayer } from '@/design/tokens';
import { typeStyle, ui } from '@/design/typography';
import { reportError } from '@/game/errorBus';
import { useLoadoutStore } from '@/hooks/useLoadout';
import { initDb } from '@/persistence/db';
import { hasUnlock, purchaseUnlock } from '@/persistence/profile';
import { ShopRow } from './ShopRow';

// ─── Tab definition ─────────────────────────────────────────────────────────

type TabId = 'palettes' | 'ornaments' | 'horns';

const TABS: { id: TabId; label: string }[] = [
  { id: 'palettes', label: '🎨 Palettes' },
  { id: 'ornaments', label: '🏵 Ornaments' },
  { id: 'horns', label: '📯 Horns' },
];

// ─── Main component ──────────────────────────────────────────────────────────

interface TicketShopProps {
  tickets: number;
  onClose: () => void;
  onTicketsChange: (n: number) => void;
}

export function TicketShop({ tickets, onClose, onTicketsChange }: TicketShopProps) {
  const [activeTab, setActiveTab] = useState<TabId>('palettes');
  const [ownedMap, setOwnedMap] = useState<Map<string, boolean>>(new Map());
  const { loadout, equip } = useLoadoutStore();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Esc closes the shop
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Resolve which items are owned for the current tab
  const itemsForTab = useCallback((): ShopItem[] => {
    switch (activeTab) {
      case 'palettes':
        return [...PALETTES, ...RIMS, ...DICE];
      case 'ornaments':
        return [...ORNAMENTS, ...HORN_SHAPES];
      case 'horns':
        return HORNS;
    }
  }, [activeTab]);

  const refreshOwned = useCallback(async () => {
    await initDb();
    const items = itemsForTab();
    const entries = await Promise.all(
      items.map(async (item) => {
        const owned = await hasUnlock(item.kind, item.slug).catch((err: unknown) => {
          reportError(err, 'TicketShop.hasUnlock');
          return false;
        });
        return [item.slug, owned] as const;
      }),
    );
    setOwnedMap(new Map(entries));
  }, [itemsForTab]);

  useEffect(() => {
    refreshOwned().catch((err) => reportError(err, 'TicketShop.refreshOwned'));
  }, [refreshOwned]);

  const handleBuy = async (item: ShopItem) => {
    try {
      // Atomic: ticket debit + unlock insert happen in one DB transaction, so
      // the player can't end up charged without the item or vice versa.
      await purchaseUnlock(item.kind, item.slug, item.cost);
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
      case 'palette':
        return loadout.palette === item.slug;
      case 'ornament':
        return loadout.ornament === item.slug;
      case 'horn':
        return loadout.horn === item.slug;
      case 'horn_shape':
        return loadout.hornShape === item.slug;
      case 'rim':
        return loadout.rim === item.slug;
      case 'dice':
        return loadout.dice === item.slug;
      default:
        return false;
    }
  };

  const items = itemsForTab();

  return (
    <div
      data-testid="ticket-shop"
      role="dialog"
      aria-modal="true"
      aria-label="Ticket Shop"
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
            <div style={{ ...typeStyle(ui.label), color: color.yellow }}>🎟 {tickets}</div>
            <BrandButton
              ref={closeButtonRef}
              kind="ghost"
              size="sm"
              onClick={onClose}
              testId="shop-close"
            >
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
