import Web3ProviderEngine, { Subprovider } from '@bitski/provider-engine';
import { AuthProvider } from '../auth/auth-provider';
import { CACHED_METHODS } from '../constants';

/*
 * Subprovider that caches values related to the user.
 */
export class AuthenticatedCacheSubprovider extends Subprovider {
    private authProvider: AuthProvider;
    private cachedValues: Map<string, any>;

    constructor(authProvider: AuthProvider, engine?: Web3ProviderEngine) {
        super();
        this.authProvider = authProvider;
        this.cachedValues = new Map<string, any>();
	if (engine) {
	  engine.on('signOut', () => this.cachedValues.clear());
	}
    }

    public handleRequest(payload, next, end) {
        // Only evaluate matching methods
        if (this.supportsCache(payload.method) === false) {
            return next();
        }

        // Allow overriding the cache
        if (payload.skipCache) {
            return next();
        }

        // Load from cache
        this.checkCachedValues(payload.method).then((value) => {
            if (value !== undefined) {
                // Value for method is cached, return value
                end(undefined, value);
            } else {
                // Value for method is not cached, fallback to fetch
                next();
            }
        }).catch(() => {
            // If method is not supported, or we encounter an error, fallback to fetch provider
            return next();
        });
    }

    private supportsCache(methodName: string): boolean {
        return CACHED_METHODS.includes(methodName);
    }

    private checkCachedValues(methodName: string): Promise<any> {
        // First, check in-memory cache
        if (this.cachedValues.has(methodName)) {
            return Promise.resolve(this.cachedValues.get(methodName));
        }
        // Fallback to local-storage cache
        switch (methodName) {
        case 'eth_accounts':
            return this.getAccounts();
        default:
            return Promise.reject(new Error('Method not supported'));
        }
    }

    private getAccounts(): Promise<string[]> {
        // TODO: Move this to a subscription model and load into memory automatically
        return this.authProvider.getUser().then((user) => {
            if (user.accounts) {
                this.cachedValues.set('eth_accounts', user.accounts);
                return user.accounts;
            }
            throw new Error('Accounts not found on user');
        });
    }
}
