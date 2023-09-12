interface ScopeBindings {
    $schema: string,
    contentVersion: string,
    scopeBindings: ScopeBinding[]
}

interface ScopeBinding {
    scopeTagName: string,
    bindings: Binding[]
}

interface Binding {
    find: string,
    replaceWith: string,
    fallback: {
        to: string
    }
}

export type {ScopeBindings, ScopeBinding, Binding}