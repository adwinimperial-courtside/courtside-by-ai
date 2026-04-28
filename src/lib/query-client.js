import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			staleTime: 30000,
			retry: (failureCount, error) => {
				// Never retry rate limit errors
				if (error?.message?.includes('429') || error?.status === 429) return false;
				return failureCount < 1;
			},
		},
	},
});