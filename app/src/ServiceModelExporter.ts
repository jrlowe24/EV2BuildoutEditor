// Class with utility functions to export the following json files
import {ServiceModel, ServiceMetadata, ServiceResourceGroupDefinition, ServiceResourceDefinition, ScopeTag} from "./definitions/ServiceModelDefinitions";


//Service Model
//Rollout Spec
//Scope Bindings
//Template & Parameter file


// For Export MVP, going to simplify the functionality with the following: 
// Give it a default ServiceResourceGroup.
// Only 1 allowed type per sourceResourceDefinition


function CreateAndExportServicModel(name: string, serviceMetadata: ServiceMetadata, serviceResourceDefs: ServiceResourceDefinition[], scopeTags: string[])
{
    const newServiceModel: ServiceModel = {
        $schema: "https://ev2schema.azure.net/schemas/2020-04-01/RegionAgnosticServiceModel.json",
        contentVersion: "0.0.0.1",
        serviceMetadata: serviceMetadata,
        serviceResourceGroupDefinitions: [
            {
                name: `DefaultServiceResourceGroupName-${name}`,
                subscriptionKey: "DefaultSubscriptionKey",
                azureResourceGroupName: "DefaultAzureResourceGroupName",
                executionConstraint: {
                    isInCloud: "",
                    quantifier: "Once",
                    level: "Region"
                },
                serviceResourceDefinitions: serviceResourceDefs,
                scopeTags: []
            }
        ]
    };

    scopeTags.forEach((tag) => {
        const newScopeTag: ScopeTag = {
            name: tag
        }
        // hard coded to the first one
        newServiceModel.serviceResourceGroupDefinitions[0].scopeTags.push(newScopeTag);
    })
    
    const serviceModelJson = JSON.stringify(newServiceModel, null, 2);
    const outputPath = `./Output/ServiceModel.${name}.json`;
    //fs.writeFileSync(outputPath, serviceModelJson);
    console.log(`ServiceModel has been exported to ${outputPath}. File: \n ${serviceModelJson}`);
    return serviceModelJson;
}

function CreateServiceResourceDefinitions(serviceResourceName: string, rolloutParameterPath: string, templatePath: string, scopeTags: string[])
{
    const newServiceResourceDefinition: ServiceResourceDefinition = {
        name: serviceResourceName,
        composedOf: {
            extension: {
                arm: {
                    templatePath: templatePath,
                    parametersPath: rolloutParameterPath
                }
            }
        },
        scopeTags: []
    }

    scopeTags.forEach((tag) => {
        const newScopeTag: ScopeTag = {
            name: tag
        }
        newServiceResourceDefinition.scopeTags.push(newScopeTag);
    }) 

    return newServiceResourceDefinition;
}

export {CreateAndExportServicModel, CreateServiceResourceDefinitions} 
