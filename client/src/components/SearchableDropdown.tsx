import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, type LucideIcon } from 'lucide-react';
import type { PresetGroup } from '../data/searchPresets';

interface SearchableDropdownProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  icon?: LucideIcon;
  groups: PresetGroup[];
  allowCustom?: boolean;
  disabled?: boolean;
}

export const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  id,
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Type to filter or search...',
  icon: Icon,
  groups,
  allowCustom = true,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
      setActiveCategory('all');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Filter groups & items
  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return groups
      .map(group => {
        if (activeCategory !== 'all' && group.category !== activeCategory) {
          return null;
        }

        const categoryMatches = group.category.toLowerCase().includes(query);
        const matchingItems = group.items.filter(item => {
          if (!query) return true;
          if (categoryMatches) return true;
          return item.toLowerCase().includes(query);
        });

        if (matchingItems.length === 0) return null;

        return {
          category: group.category,
          items: matchingItems
        };
      })
      .filter((g): g is PresetGroup => g !== null);
  }, [groups, searchQuery, activeCategory]);

  const totalFilteredItems = useMemo(() => {
    return filteredGroups.reduce((acc, g) => acc + g.items.length, 0);
  }, [filteredGroups]);

  const handleSelect = (item: string) => {
    onChange(item);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const isExactMatch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return false;
    return groups.some(g => g.items.some(i => i.toLowerCase() === q));
  }, [groups, searchQuery]);

  return (
    <div 
      ref={containerRef} 
      style={{ position: 'relative', width: '100%', zIndex: isOpen ? 100 : 1 }}
      id={id}
    >
      {/* Trigger Button */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '8px',
          background: 'rgba(0, 0, 0, 0.25)',
          border: isOpen ? '1px solid var(--primary)' : '1px solid var(--border-color)',
          color: value ? 'var(--text-main)' : 'var(--text-muted)',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          boxShadow: isOpen ? '0 0 12px rgba(139, 92, 246, 0.25)' : 'none',
          transition: 'all 0.2s ease',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {Icon && <Icon size={15} style={{ color: value ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: value ? 500 : 400 }}>
            {value || placeholder}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px', flexShrink: 0 }}>
          {value && !disabled && (
            <span
              role="button"
              onClick={handleClear}
              title="Clear selection"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown
            size={15}
            style={{
              color: 'var(--text-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          />
        </div>
      </div>

      {/* Floating Dropdown Popover */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '100%',
            minWidth: '340px',
            maxWidth: '520px',
            maxHeight: '440px',
            background: '#121422',
            border: '1px solid rgba(139, 92, 246, 0.45)',
            borderRadius: '10px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 25px rgba(139, 92, 246, 0.25)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {/* Search Box Header */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.12)'
              }}
            >
              <Search size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  width: '100%',
                  fontFamily: 'inherit'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Category Filter Pills (if more than 1 category) */}
            {groups.length > 1 && (
              <div 
                style={{ 
                  display: 'flex', 
                  gap: '6px', 
                  overflowX: 'auto', 
                  paddingTop: '8px',
                  paddingBottom: '2px',
                  scrollbarWidth: 'none'
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  style={{
                    padding: '3px 9px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 500,
                    border: activeCategory === 'all' ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: activeCategory === 'all' ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                    color: activeCategory === 'all' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  All
                </button>
                {groups.map(g => (
                  <button
                    key={g.category}
                    type="button"
                    onClick={() => setActiveCategory(g.category)}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 500,
                      border: activeCategory === g.category ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: activeCategory === g.category ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      color: activeCategory === g.category ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {g.category}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Typed Value Option */}
          {allowCustom && searchQuery.trim() && !isExactMatch && (
            <div
              role="button"
              onClick={() => handleSelect(searchQuery.trim())}
              style={{
                padding: '9px 14px',
                background: 'rgba(139, 92, 246, 0.15)',
                borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                color: '#c084fc',
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>✨</span>
                <span>Use custom: <strong>"{searchQuery.trim()}"</strong></span>
              </div>
              <span style={{ fontSize: '11px', opacity: 0.8, background: 'rgba(139, 92, 246, 0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                Select
              </span>
            </div>
          )}

          {/* List of Options */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              padding: '6px 0',
              maxHeight: '260px'
            }}
          >
            {filteredGroups.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                <p>No matching options found</p>
                {allowCustom && searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelect(searchQuery.trim())}
                    className="btn btn-secondary"
                    style={{ marginTop: '10px', fontSize: '12px', padding: '6px 12px' }}
                  >
                    Use "{searchQuery.trim()}" anyway
                  </button>
                )}
              </div>
            ) : (
              filteredGroups.map(group => (
                <div key={group.category} style={{ marginBottom: '6px' }}>
                  <div
                    style={{
                      padding: '6px 14px 4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-muted)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{group.category}</span>
                    <span style={{ opacity: 0.6, fontSize: '10px' }}>{group.items.length}</span>
                  </div>

                  {group.items.map(item => {
                    const isSelected = value === item;
                    return (
                      <div
                        key={item}
                        role="button"
                        onClick={() => handleSelect(item)}
                        style={{
                          padding: '8px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '13px',
                          color: isSelected ? '#fff' : 'var(--text-main)',
                          background: isSelected ? 'rgba(139, 92, 246, 0.22)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) {
                            (e.currentTarget as HTMLDivElement).style.background = 'rgba(255, 255, 255, 0.05)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) {
                            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                          }
                        }}
                      >
                        <span style={{ fontWeight: isSelected ? 600 : 400 }}>{item}</span>
                        {isSelected && <Check size={14} color="var(--primary)" />}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer with status */}
          <div
            style={{
              padding: '6px 14px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0, 0, 0, 0.2)'
            }}
          >
            <span>{totalFilteredItems} options available</span>
            {value && (
              <span 
                role="button"
                onClick={() => { onChange(''); setIsOpen(false); }}
                style={{ cursor: 'pointer', color: 'var(--danger)', opacity: 0.85 }}
              >
                Clear choice
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
