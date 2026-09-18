export type SearchIndex = "projects" | "customers" | "people" | "photos" | "notes" | "tasks" | "reports";

export type SearchHit = {
  index: SearchIndex;
  id: string;
  title: string;
  subtitle?: string;
};

export interface SearchService {
  search(companyId: string, query: string, indexes?: SearchIndex[]): Promise<SearchHit[]>;
}

export class SqlSearchService implements SearchService {
  async search(): Promise<SearchHit[]> {
    throw new Error("Use searchCompany() in search-service. This adapter is a swap point for a dedicated engine.");
  }
}

export function createSearchService(): SearchService {
  return new SqlSearchService();
}
