import { Search, X } from 'lucide-preact';
import { type PopupStore } from '../state/popup.store';

interface SearchBarProps {
  store: PopupStore;
}

export function SearchBar({ store }: SearchBarProps) {
  const query = store.searchQuery.value;
  const trimmed = query.trim();
  const matchedCount = store.searchResult.value.matchedTabCount;

  return (
    <div class="search-wrap" style={{ padding: '0 var(--space-3) var(--space-2)' }}>
      <span class="search-icon" aria-hidden="true" style={{ left: '20px' }}>
        <Search size={13} />
      </span>

      <input
        type="search"
        class="search-input"
        value={query}
        placeholder="Search groups, titles, or URLs (Esc clears)..."
        aria-label="Search tabs and groups"
        onInput={(event) => {
          store.setSearchQuery(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && query.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            store.clearSearch();
          }
        }}
      />

      {trimmed.length > 0 && (
        <div class="search-actions" style={{ right: '18px' }}>
          <span class="search-count" title="Matching tabs">
            {matchedCount}
          </span>
          <button
            type="button"
            class="search-clear-btn"
            aria-label="Clear search"
            onClick={() => { store.clearSearch(); }}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
