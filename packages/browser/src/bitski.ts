import { AuthorizationServiceConfiguration } from '@openid/appauth';
import { BitskiEngine, BitskiEngineOptions, Kovan, Mainnet, Network, Rinkeby } from 'bitski-provider';
import { LOGIN_HINT_SIGNUP, SignInOptions } from './auth/oauth-manager';
import { OpenidAuthProvider } from './auth/openid-auth-provider';
import { User } from './auth/user';
import { ConnectButton, ConnectButtonOptions, ConnectButtonSize } from './components/connect-button';
import { SDK_VERSION } from './constants';
import { BitskiBrowserEngine } from './providers/bitski-browser-engine';
import css from './styles/index';
import { processCallback } from './utils/callback';
import { LocalStorageStore } from './utils/localstorage-store';
import { Store } from './utils/store';

export enum OAuthSignInMethod {
  Redirect = 'REDIRECT',
  Popup = 'POPUP',
  Silent = 'SILENT', // Deprecated
}

export enum AuthenticationStatus {
  Connected = 'CONNECTED',
  Expired = 'EXPIRED',
  NotConnected = 'NOT_CONNECTED',
}

// Customize token and user caching
export { Store, LocalStorageStore };

// Sign-in Options
export { SignInOptions, LOGIN_HINT_SIGNUP };

// Networks
export { Network, Mainnet, Rinkeby, Kovan };

// Connect Button
export { ConnectButtonSize, ConnectButtonOptions };

// Errors
export { AuthenticationError, AuthenticationErrorCode } from './errors/authentication-error';
export { ParseError, ParseErrorCode } from './errors/parse-error';
export { SignerError, SignerErrorCode } from './errors/signer-error';

export interface BitskiSDKOptions {
  // Customize oauth configuration
  configuration?: AuthorizationServiceConfiguration;
  // Customize how tokens and user data are stored.
  store?: Store;
}

export interface ProviderOptions extends BitskiEngineOptions {
  networkName?: string;
  network?: Network;
  pollingInterval?: number;
  disableCaching?: boolean;
  disableValidation?: boolean;
  disableBlockTracking?: boolean;
  additionalHeaders?: object;
  webBaseUrl?: string;
  apiBaseUrl?: string;
  minGasPrice?: number;
  callbackURL?: string;
}

/**
 * Bitski SDK
 */
export class Bitski {
  /**
   * Alternative to using our static callback.html file. Call this from your own redirect page.
   */
  public static callback(): void {
    processCallback();
  }

  private engines = new Map<string, BitskiEngine>();
  private clientId: string;
  private authProvider: OpenidAuthProvider;
  private signoutHandlers: Array<() => void> = [];
  private sdkVersion: string;

  /**
   * @param clientId OAuth Client ID
   * @param redirectUri Redirect uri, defaults to the current url. This should be the location of your callback html file.
   * @param additionalScopes To use custom scopes, add them here. The default value is ['offline'].
   * Note: Make sure your app is approved for the scopes you are requesting first.
   * @param options Other OAuth settings. Don't change these unless you know what you are doing.
   */
  constructor(clientId: string, redirectUri?: string, additionalScopes?: string[], options?: BitskiSDKOptions) {
    this.clientId = clientId;
    this.sdkVersion = SDK_VERSION;
    this.authProvider = new OpenidAuthProvider(clientId, redirectUri || window.location.href, additionalScopes, options);
    if (document && document.body) {
      this.injectStyles();
    } else {
      window.addEventListener('load', () => {
        this.injectStyles();
      });
    }
    this.authProvider.signOutCallback = this.onSignOut.bind(this);
  }

  /**
   * Returns a new web3 provider for a given network.
   * @param options options for the provider, or a network name
   */
  public getProvider(options?: ProviderOptions | string): BitskiEngine {
    // Check cache for existing provider
    const existingProvider = this.engines.get(JSON.stringify(options));
    if (existingProvider) {
      existingProvider.start();
      return existingProvider;
    }
    // Create a new provider if one does not exist
    let normalizedOptions: ProviderOptions = {};
    if (options && typeof options !== 'string') {
      normalizedOptions = options;
    }
    const network = this.networkFromProviderOptions(options);
    if (network === Kovan && normalizedOptions.minGasPrice == null) {
      normalizedOptions.minGasPrice = 1;
    }
    const newProvider = this.createProvider(network, normalizedOptions);
    newProvider.start();
    this.engines.set(JSON.stringify(options), newProvider);
    return newProvider;
  }

  /**
   * Creates a sign in with bitski button to add to your app. If an HTML element is passed in as the
   * first parameter, it will automatically add it to the DOM inside that element. Make sure to add
   * a callback to get notified of login events.
   * @param options {ConnectButtonOptions} Optional configuration for the button
   * @param callback Post-login callback. Called when sign in is complete. Not applicable for redirect login method.
   */
  public getConnectButton(options?: ConnectButtonOptions, callback?: (error?: Error, user?: any) => void): ConnectButton {
    return new ConnectButton(this.authProvider, options, callback);
  }

  /**
   * Signs in or connects to bitski depending on the user's auth state.
   * Since it may open a popup, this method must be called from user interaction handler,
   * such as a click or tap handler.
   * @param options Provide SignInOptions for the sign in request. See signIn() for more info.
   */
  public start(options?: SignInOptions): Promise<User> {
    return this.authProvider.signInOrConnect(undefined, options);
  }

  /**
   * Check the logged in state of the user
   */
  public get authStatus(): AuthenticationStatus {
    return this.authProvider.authStatus;
  }

  /**
   * Starts the sign in flow. Will trigger a popup window over your app, so it must be called within a user interaction handler such as a click.
   * @param options Optionally provide additional options for the sign in request.
   *
   * You can use the options parameter to request that we show the sign up form instead of the sign in form:
   * ```javascript
   * import { LOGIN_HINT_SIGNUP } from 'bitski';
   *
   * await bitski.signIn({ login_hint: LOGIN_HINT_SIGNUP });
   * ```
   */
  public signIn(options?: SignInOptions): Promise<User> {
    return this.authProvider.signIn(OAuthSignInMethod.Popup, options);
  }

  /**
   * Gets the current signed in user. Will reject if we are not signed in.
   */
  public getUser(): Promise<User> {
    return this.authProvider.getUser();
  }

  /**
   * Connects to bitski to get a valid access token if possible.
   */
  public connect(): Promise<User> {
    return this.authProvider.connect();
  }

  /**
   * Starts redirect sign in flow. This is an alternative flow to the popup that all takes place in the same browser window.
   * @param options Optionally provide additional options for the sign in request. See signIn() for more info.
   */
  public signInRedirect(options?: SignInOptions): void {
    this.authProvider.signIn(OAuthSignInMethod.Redirect, options);
  }

  /**
   * Call from your oauth redirect page.
   */
  public redirectCallback(): Promise<User> {
    return this.authProvider.redirectCallback();
  }

  /**
   * Retrieves the current access token for the user, if logged in.
   */
  public getCurrentAccessToken(): Promise<string> {
    return this.authProvider.getAccessToken();
  }

  /**
   * Retrieves the current refresh token for the user, if logged in.
   * Requires that the user has approved your application for offline access.
   */
  public getCurrentRefreshToken(): Promise<string> {
    return this.authProvider.getRefreshToken();
  }

  /**
   * Register a callback to be called on sign out. This is a good practice,
   * since there may be situations where you are signed out unexpectedly.
   * @param fn Your callback function
   */
  public addSignOutHandler(fn: () => void) {
    this.signoutHandlers.push(fn);
  }

  /**
   * Remove a registered signout callback
   * @param fn Your callback function
   */
  public removeSignOutHandler(fn: () => void) {
    const index = this.signoutHandlers.findIndex((item) => item === fn);
    if (index >= 0) {
      this.signoutHandlers.splice(index, 1);
    }
  }

  /**
   * Sign the current user out of your application.
   */
  public signOut(): Promise<void> {
    this.engines.forEach((engine) => engine.emit('signOut'));
    return this.authProvider.signOut();
  }

  private createProvider(network: Network, options: ProviderOptions = {}): BitskiEngine {
    return new BitskiBrowserEngine(this.clientId, this.authProvider, this.sdkVersion, network, options);
  }

  private networkFromName(networkName: string): Network {
    switch (networkName) {
    case '':
    case 'mainnet':
      return Mainnet;
    case 'rinkeby':
      return Rinkeby;
    case 'kovan':
      return Kovan;
    default:
      throw new Error(`Unsupported network name ${networkName}. Try passing a \`network\` in the options instead.`);
    }
  }

  private networkFromProviderOptions(options: ProviderOptions | string | undefined): Network {
    if (!options) {
      return Mainnet;
    }
    if (typeof options === 'string') {
      return this.networkFromName(options);
    }
    if (options.network) {
      return options.network;
    }
    if (options.networkName) {
      return this.networkFromName(options.networkName);
    }
    return Mainnet;
  }

  private onSignOut() {
    this.signoutHandlers.forEach((cb) => {
      cb();
    });
  }

  /**
   * Embeds Bitski's UI styles
   */
  private injectStyles(): void {
    if (document.getElementById('BitskiEmbeddedStyles')) {
      return;
    }
    const style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('id', 'BitskiEmbeddedStyles');
    style.appendChild(document.createTextNode(css));
    const head = document.head || document.getElementsByTagName('head')[0];
    head.appendChild(style);
  }

}
