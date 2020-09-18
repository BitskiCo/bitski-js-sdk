import { User } from '../src/auth/user';
import { AuthenticationStatus, Bitski, Mainnet, OAuthSignInMethod, Rinkeby } from '../src/bitski';

const clientID = 'test-client-id';

const dummyUser = new User('test-user');

function createInstance(): Bitski {
  return new Bitski(clientID, '');
}

describe('managing providers', () => {

  beforeEach(() => {
    // This doesn't seem to be working. Instead catching network errors and silencing them.
    // @ts-ignore
    fetch.mockResponse(JSON.stringify({ jsonrpc: '2.0', id: 0, result: null }));
  });

  test('should get a mainnet provider by default', () => {
    const bitski = createInstance();
    const provider = bitski.getProvider();
    provider.on('error', (error) => {});
    // @ts-ignore
    expect(provider.rpcHeaders['X-CLIENT-ID']).toBe('test-client-id');
    expect(provider).toBeDefined();
    // @ts-ignore
    expect(provider.network).toBe(Mainnet);
  });

  test('should get a mainnet provider when passing options with no network name', () => {
    const bitski = createInstance();
    const provider = bitski.getProvider({ pollingInterval: 1000000 });
    provider.on('error', (error) => {});
    expect(provider).toBeDefined();
    // @ts-ignore
    expect(provider.network).toBe(Mainnet);
  });

  test('should be able to pass a network name as a string', () => {
    const bitski = createInstance();
    const provider = bitski.getProvider('rinkeby');
    provider.on('error', (error) => {});
    expect(provider).toBeDefined();
    // @ts-ignore
    expect(provider.network).toBe(Rinkeby);
  });

  test('should be able to pass a network name in options', () => {
    const bitski = createInstance();
    const provider = bitski.getProvider({ networkName: 'rinkeby' });
    provider.on('error', (error) => {});
    expect(provider).toBeDefined();
    // @ts-ignore
    expect(provider.network).toBe(Rinkeby);
  });

  test('passing an invalid network name results in an error', () => {
    const bitski = createInstance();
    expect(() => { bitski.getProvider('ropstem'); }).toThrow(/Unsupported network/);
  });

  test('should be able to pass a custom network in options', () => {
    const bitski = createInstance();
    const provider = bitski.getProvider({
      network: {
        rpcUrl: 'http://localhost:3000/web3',
        chainId: 0,
      },
    });
    provider.on('error', (error) => {});
    expect(provider).toBeDefined();
    // @ts-ignore
    expect(provider.network.rpcUrl).toBe('http://localhost:3000/web3');
  });

  test('should be able to pass in custom configuration', () => {
    const bitski = createInstance();
    const provider = bitski.getProvider({
      network: {
        rpcUrl: 'https://api-v2.otl.com/web3/rinkeby',
        chainId: 4,
      },
      webBaseUrl: 'https://next.bitski.com',
    });
    provider.on('error', (error) => {});
    expect(provider).toBeDefined();
    // @ts-ignore
    expect(provider.rpcHeaders['X-CLIENT-ID']).toBeUndefined();
    // @ts-ignore
    expect(provider.network.chainId).toBe(4);
    // @ts-ignore
    expect(provider.webBaseUrl).toBe('https://next.bitski.com');
    // @ts-ignore
    expect(provider.network.rpcUrl).toBe('https://api-v2.otl.com/web3/rinkeby');
  });

  test('should pass settings to provider-engine', () => {
    const bitski = createInstance();
    const provider = bitski.getProvider({ networkName: 'mainnet', pollingInterval: 10000000 });
    provider.on('error', (error) => {});
    // @ts-ignore
    expect(provider._blockTracker._blockTracker._pollingInterval).toBe(10000000);
  });

  test('should pass additional headers to providers', () => {
    const bitski = createInstance();
    const provider = bitski.getProvider({
      networkName: 'rinkeby',
      additionalHeaders: {
        'X-FOO-FEATURE': 'ENABLED',
      },
    });
    provider.on('error', (error) => {});
    expect(provider).toBeDefined();
    // @ts-ignore
    expect(provider.headers['X-FOO-FEATURE']).toBe('ENABLED');
  });

  test('should create new provider if one doesnt yet exist', () => {
    const bitski = createInstance();
    // @ts-ignore
    expect(bitski.engines.size).toBe(0);
    const provider = bitski.getProvider('kovan');
    provider.on('error', (error) => {});
    // @ts-ignore
    expect(bitski.engines.size).toBe(1);
  });

  test('should not create a new provider if one already exists for that network', () => {
    const bitski = createInstance();
    // @ts-ignore
    expect(bitski.engines.size).toBe(0);
    bitski.getProvider('kovan');
    // @ts-ignore
    expect(bitski.engines.size).toBe(1);
    bitski.getProvider('kovan');
    // @ts-ignore
    expect(bitski.engines.size).toBe(1);
  });

  test('should not stop engine when force logged out', () => {
    expect.assertions(2);
    const bitski = createInstance();
    const provider = bitski.getProvider('kovan');

    // Assert the error is passed through
    provider.on('error', (error) => { expect(error.message).toMatch(/Not signed in/); });

    // Assert the provider is not stopped
    const spy = jest.spyOn(provider, 'stop');
    provider.emit('error', new Error('Not signed in'));
    expect(spy).not.toHaveBeenCalled();
  });

  test('should throw an error when passing host string as name', () => {
    const bitski = createInstance();
    expect(() => { bitski.getProvider('http://localhost:7545'); }).toThrow(/Unsupported network name/);
  });
});

describe('authentication', () => {

  test('start calls signInOrConnect', () => {
    expect.assertions(2);
    const bitski = createInstance();
    // @ts-ignore
    const spy = jest.spyOn(bitski.authProvider, 'signInOrConnect');
    spy.mockResolvedValue(dummyUser);
    return bitski.start().then((user) => {
      expect(user).toBe(dummyUser);
      expect(spy).toHaveBeenCalled();
    });
  });

  test('should get auth status from auth provider', () => {
    const bitski = createInstance();
    // @ts-ignore
    const spy = jest.spyOn(bitski.authProvider, 'authStatus', 'get');
    spy.mockReturnValue(AuthenticationStatus.Connected);
    const authStatus = bitski.authStatus;
    expect(authStatus).toBe(AuthenticationStatus.Connected);
    expect(authStatus).toBe(bitski.authStatus);
  });

  test('should log in via popup', () => {
    expect.assertions(2);
    const bitski = createInstance();
    // @ts-ignore
    const spy = jest.spyOn(bitski.authProvider, 'signIn');
    spy.mockResolvedValue(dummyUser);
    return bitski.signIn().then((user) => {
      expect(spy).toHaveBeenCalledWith(OAuthSignInMethod.Popup, undefined);
      expect(user).toBe(dummyUser);
    });
  });

  test('should pass options when signing in', () => {
    expect.assertions(2);
    const bitski = createInstance();
    // @ts-ignore
    const spy = jest.spyOn(bitski.authProvider, 'signIn');
    spy.mockResolvedValue(dummyUser);
    const opts = { login_hint: 'foo' };
    return bitski.signIn(opts).then((user) => {
      expect(spy).toHaveBeenCalledWith(OAuthSignInMethod.Popup, opts);
      expect(user).toBe(dummyUser);
    });
  });

  test('can login via redirect', (done) => {
    expect.assertions(1);
    const bitski = createInstance();
    // @ts-ignore
    const spy = jest.spyOn(bitski.authProvider, 'signIn');
    spy.mockResolvedValue(dummyUser);
    bitski.signInRedirect();
    setTimeout(() => {
      expect(spy).toHaveBeenCalledWith(OAuthSignInMethod.Redirect, undefined);
      done();
    }, 500);
  });

  test('should pass options when signing in via redirect', (done) => {
    expect.assertions(1);
    const bitski = createInstance();
    // @ts-ignore
    const spy = jest.spyOn(bitski.authProvider, 'signIn');
    spy.mockResolvedValue(dummyUser);
    const opts = { login_hint: 'foo' };
    bitski.signInRedirect(opts);
    setTimeout(() => {
      expect(spy).toHaveBeenCalledWith(OAuthSignInMethod.Redirect, opts);
      done();
    }, 500);
  });

  test('should connect by refreshing access token', () => {
    expect.assertions(2);
    const bitski = createInstance();
    localStorage.setItem('bitski.refresh_token.test-client-id', 'test-refresh-token');
    // @ts-ignore
    const spy = jest.spyOn(bitski.authProvider, 'refreshAccessToken');
    // @ts-ignore
    const userSpy = jest.spyOn(bitski.authProvider, 'loadUser');
    const mockUser = {
      accounts: ['test-account'],
      id: 'foo',
    };
    userSpy.mockResolvedValue(mockUser);
    spy.mockResolvedValue('test-access-token');
    return bitski.connect().then((user) => {
      expect(spy).toHaveBeenCalled();
      expect(user).toBe(mockUser);
      localStorage.clear();
    });
  });

  test('can get user from auth provider', () => {
    expect.assertions(2);
    const bitski = createInstance();
    // @ts-ignore
    const spy = jest.spyOn(bitski.authProvider, 'getUser');
    const mockUser = {
      sub: 'test-user',
    };
    spy.mockResolvedValue(mockUser);
    return bitski.getUser().then((user) => {
      expect(spy).toHaveBeenCalled();
      expect(user).toBe(mockUser);
    });
  });

  test('should submit redirect callback', () => {
    const bitski = createInstance();
    // @ts-ignore
    const spy = jest.spyOn(bitski.authProvider, 'redirectCallback');
    bitski.redirectCallback();
    expect(spy).toHaveBeenCalled();
  });

  test('can add and remove signout callbacks', () => {
    expect.assertions(3);
    const bitski = createInstance();
    // @ts-ignore
    expect(bitski.signoutHandlers.length).toEqual(0);
    const callback = jest.fn();
    bitski.addSignOutHandler(callback);
    // @ts-ignore
    expect(bitski.signoutHandlers.length).toEqual(1);
    bitski.removeSignOutHandler(callback);
    // @ts-ignore
    expect(bitski.signoutHandlers.length).toEqual(0);
  });

  test('signout callbacks are called upon sign out', () => {
    expect.assertions(1);
    const bitski = createInstance();
    // @ts-ignore
    jest.spyOn(bitski.authProvider.oauthManager, 'requestSignOut').mockResolvedValue({});
    const callback = jest.fn();
    bitski.addSignOutHandler(callback);
    return bitski.signOut().then(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});

describe('working with access tokens', () => {
  test('should be able to get an access token if the user is logged in', () => {
    const bitski = createInstance();
    jest.spyOn(bitski.authProvider, 'getAccessToken').mockResolvedValue('test-access-token');
    return bitski.getCurrentAccessToken().then((accessToken) => {
      expect(accessToken).toBe('test-access-token');
    });
  });

  test('should be able to get a refresh token if the user is logged in', () => {
    const bitski = createInstance();
    jest.spyOn(bitski.authProvider, 'getRefreshToken').mockResolvedValue('test-refresh-token');
    return bitski.getCurrentRefreshToken().then((refreshToken) => {
      expect(refreshToken).toBe('test-refresh-token');
    });
  });
});

describe('connect button', () => {
  test('should be able to create connect button', () => {
    const bitski = createInstance();
    const connectButton = bitski.getConnectButton();
    expect(connectButton).toBeDefined();
    expect(connectButton.element.onclick).toBeDefined();
  });

  test('should be able to pass callback to connect button', () => {
    const bitski = createInstance();
    const callback = jest.fn();
    const connectButton = bitski.getConnectButton(undefined, callback);
    expect(connectButton.callback).toBe(callback);
  });
});
