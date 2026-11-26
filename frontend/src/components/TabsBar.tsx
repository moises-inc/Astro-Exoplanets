import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { TabId } from '../types/exoplanet';

export interface TabDefinition {
  id: TabId;
  label: string;
}

interface TabsBarProps {
  ariaLabel: string;
  tabs: TabDefinition[];
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
}

export function TabsBar({ ariaLabel, tabs, activeTab, onChangeTab }: TabsBarProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = tabs.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const target = tabs[nextIdx];
      onChangeTab(target.id);
      buttonRefs.current[nextIdx]?.focus();
    }
  };

  return (
    <div role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, idx) => {
        const selected = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              buttonRefs.current[idx] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChangeTab(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  id: TabId;
  active: boolean;
  onActivateFromFind: (id: TabId) => void;
  children: ReactNode;
}

export function TabPanel({ id, active, onActivateFromFind, children }: TabPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (active) {
      el.removeAttribute('hidden');
    } else {
      el.setAttribute('hidden', 'until-found');
    }
  }, [active]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const handleBeforeMatch = () => {
      onActivateFromFind(id);
    };
    el.addEventListener('beforematch', handleBeforeMatch);
    return () => {
      el.removeEventListener('beforematch', handleBeforeMatch);
    };
  }, [id, onActivateFromFind]);

  return (
    <div
      ref={panelRef}
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
    >
      <div className="tab-panel-inner">{children}</div>
    </div>
  );
}
