export type Action =
    | { readonly type: 'purchase'; readonly purchasableId: string }
    | { readonly type: 'navigate'; readonly url: string };
