interface ServiceModel {
    $schema: string;
    contentVersion: string;
    serviceMetadata: ServiceMetadata;
    serviceResourceGroupDefinitions: ServiceResourceGroupDefinition[]; // You can define a specific type here if needed
}

interface ServiceMetadata {
    serviceSpecificationPath: string;
    serviceIdentifier: string;
    displayName: string;
    serviceGroup: string;
    environment: string;
    tenantId: string;
}
  
interface ServiceResourceGroupDefinition {
    name: string,
    subscriptionKey: string,
    azureResourceGroupName: string,
    executionConstraint: {
        isInCloud: string,
        quantifier: "Once",
        level: "Region"
    },
    serviceResourceDefinitions: ServiceResourceDefinition[],
    scopeTags: ScopeTag[]
}

interface ServiceResourceDefinition {
    name: string,
    composedOf: {
        extension: {
            arm: {
                templatePath: string,
                parametersPath: string
            }
        }
    },
    scopeTags: ScopeTag[]
}

interface ScopeTag {
    name: string
}
export type {ServiceModel, ServiceMetadata, ServiceResourceGroupDefinition, ServiceResourceDefinition, ScopeTag}