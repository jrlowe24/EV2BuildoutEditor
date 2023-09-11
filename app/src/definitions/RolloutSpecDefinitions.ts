interface RolloutSpec {
    $schema: string,
    contentVersion: string,
    rolloutMetadata: RolloutMetadata
    orchestratedSteps: OrchestratedStep[]
};

interface RolloutMetadata {
    serviceModelPath: string,
    scopeBindingsPath: string,
    name: string,
    rolloutType: string,
    buildSource: {
        parameters: {
            versionFile: string
        }
    },
    configuration: {
        serviceScope: {
            specPath: string
        },
        serviceGroupScope: {
            specPath: string
        }
    }
};

interface OrchestratedStep {
    name: string,
    targetType: string,
    targetName: string,
    actions: string[],
    dependsOn: string[]
};

export type {RolloutSpec, RolloutMetadata, OrchestratedStep}