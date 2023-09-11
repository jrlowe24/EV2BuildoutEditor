import {RolloutSpec, RolloutMetadata, OrchestratedStep} from "./definitions/RolloutSpecDefinitions";


function CreateAndExportRolloutSpec(name: string, metadata: RolloutMetadata, steps: OrchestratedStep[])
{
    const newRolloutSpec : RolloutSpec = {
        $schema: "https://ev2schema.azure.net/schemas/2020-04-01/RegionAgnosticRolloutSpecification.json",
        contentVersion: "1.0.0.0",
        rolloutMetadata: 
        {
            serviceModelPath: `ServiceModel.${name}.json`,
            scopeBindingsPath: "ScopeBindings.json",
            name: "Azure Monitor Metrics MetricsRP Buildout",
            rolloutType: "Major",
            buildSource: {
                parameters: {
                    versionFile: "BuildVer.txt"
                }
            },
            configuration: {
                // use below serviceScope if need to test or pilot changes in some rollouts but don't want to impact other rollouts
                serviceScope: {
                    specPath: "Configurations\\MetricsRp.$rolloutInfra().Config.json"
                },
                serviceGroupScope: {
                    specPath: "Configurations\\MetricsRp.$rolloutInfra().Config.json"
                }
            },
        },
        orchestratedSteps: steps
    }

    const rolloutSpecJson = JSON.stringify(newRolloutSpec, null, 2);
    const outputPath = `./Output/RolloutSpec.${name}.json`;
    console.log(`RolloutSpec has been exported to ${outputPath}. File: \n ${rolloutSpecJson}`);
}

function CreateOrchestratedStep(name: string, targetType: string, targetName: string, actions: string[], dependsOn: string[])
{
    const newStep : OrchestratedStep = {
        name: name,
        targetType: targetType,
        targetName: targetName,
        actions: actions,
        dependsOn: dependsOn
    }

    return newStep;
}

export {CreateAndExportRolloutSpec, CreateOrchestratedStep}