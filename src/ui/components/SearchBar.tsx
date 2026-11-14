import { Search, X } from 'lucide-preact';
import { type PopupStore } from '../state/popup.store';

interface SearchBarProps {
  store: PopupStore;
}

export function SearchBar({ store }: SearchBarProps) {
  const query = store.searchQuery.value;
  const trimmed = query.trim();
  const matchedCount = store.searchResult.value.totalMatchedItems;

  return (
    <div class="search-section">
      <div class="search-field">
        <span class="search-icon" aria-hidden="true">
          <Search size={14} />
        </span>

        <input
          type="search"
          class="search-input"
          value={query}
          placeholder="Search groups, titles, or URLs..."
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

        <div class="search-actions">
          {trimmed.length > 0 ? (
            <>
              <span class="search-count" title="Matching results">
                {matchedCount}
              </span>
              <button
                type="button"
                class="search-clear-btn"
                aria-label="Clear search"
                title="Clear search (Esc)"
                onClick={() => {
                  store.clearSearch();
                }}
              >
                <X size={12} />
              </button>
            </>
          ) : (
            <kbd class="kbd-hint" aria-hidden="true">
              Esc
            </kbd>
          )}
        </div>
      </div>
    </div>
  );
}
