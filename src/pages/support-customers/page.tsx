import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerSearch } from './hooks';
import CustomerResultCard from './components/CustomerResultCard';

export default function SupportCustomersPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { results, loading, error, searched, search } = useCustomerSearch();

  const runSearch = () => search(query);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground-50">Customers</h1>
        <p className="text-sm text-foreground-500 mt-1">
          Search across Digital Footprint customers to resolve tickets and open their Customer 360.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500 w-4 h-4 flex items-center justify-center"></i>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Name, email, user ID, organisation, site or ticket number"
            className="w-full bg-background-100 border border-background-200/60 focus:border-accent-500/40 rounded-lg pl-9 pr-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={runSearch}
          disabled={loading || !query.trim()}
          className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
        >
          Search
        </button>
      </div>

      <div className="space-y-2">
        {loading && (
          <div className="space-y-2">
            <div className="h-20 bg-background-100 rounded-lg animate-pulse"></div>
            <div className="h-20 bg-background-100 rounded-lg animate-pulse"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && !searched && (
          <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
              <i className="ri-user-search-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
            </div>
            <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">
              Search for a customer
            </h3>
            <p className="text-sm text-foreground-500 max-w-sm mx-auto">
              You can search by name, email, user ID, organisation, site, or ticket number.
            </p>
          </div>
        )}

        {!loading && !error && searched && results.length === 0 && (
          <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
              <i className="ri-user-search-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
            </div>
            <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">No customers found</h3>
            <p className="text-sm text-foreground-500">Try a different name, email or user ID.</p>
          </div>
        )}

        {!loading &&
          results.map((r) => (
            <CustomerResultCard
              key={r.customer_id}
              result={r}
              onClick={() => navigate(`/customers/${r.customer_id}`)}
            />
          ))}
      </div>
    </div>
  );
}