export type Action =
    | { readonly type: 'purchase'; readonly purchasableId: string }
    | { readonly type: 'navigate'; readonly url: string }
    | { readonly type: 'submitCredentials'; readonly url: string; readonly username: string; readonly password: string }
    | { readonly type: 'automate' }
    | { readonly type: 'setActivity'; readonly activity: string }
    | { readonly type: 'assignJob'; readonly jobId: string; readonly change: number }
    | { readonly type: 'replaceProxy'; readonly proxyIndex: number }
    | { readonly type: 'answerCaptcha'; readonly answer: string }
    | { readonly type: 'addFavorite'; readonly url: string }
    | { readonly type: 'setSound'; readonly enabled: boolean };
