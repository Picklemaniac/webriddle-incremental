export type Action =
    | { readonly type: 'purchase'; readonly purchasableId: string }
    | { readonly type: 'navigate'; readonly url: string }
    | { readonly type: 'submitCredentials'; readonly url: string; readonly username: string; readonly password: string }
    | { readonly type: 'automate' }
    | { readonly type: 'setActivity'; readonly activity: string }
    | { readonly type: 'checkIn' }
    | { readonly type: 'setThrottle'; readonly enabled: boolean }
    | { readonly type: 'setRentedAddresses'; readonly count: number }
    | { readonly type: 'assignJob'; readonly jobId: string; readonly change: number }
    | { readonly type: 'replaceProxy'; readonly proxyIndex: number }
    | { readonly type: 'answerCaptcha'; readonly answer: string }
    | { readonly type: 'addFavorite'; readonly url: string }
    | { readonly type: 'removeFavorite'; readonly url: string }
    | { readonly type: 'setHomePage'; readonly url: string }
    | { readonly type: 'clearHistory' };
