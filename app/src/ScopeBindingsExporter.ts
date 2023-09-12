import {
  ScopeBindings,
  ScopeBinding,
  Binding,
} from "./definitions/ScopeBindingDefinitions";

function CreateAndExportScopeBindings(scopeBindings: ScopeBinding[]) {
  const newScopeBindings: ScopeBindings = {
    $schema:
      "https://ev2schema.azure.net/schemas/2020-01-01/scopeBindings.json",
    contentVersion: "1.0.0.0",
    scopeBindings: scopeBindings,
  };

  const scopeBindingsJson = JSON.stringify(newScopeBindings, null, 2);
  const outputPath = `./Output/ScopeBindings.json`;
  //fs.writeFileSync(outputPath, serviceModelJson);
  console.log(
    `ScopeBindings has been exported to ${outputPath}. File: \n ${scopeBindingsJson}`
  );
}

function CreateScopeBinding(name: string, bindings: Binding[]) {
  const newScopeBinding: ScopeBinding = {
    scopeTagName: name,
    bindings: bindings,
  };

  return newScopeBinding;
}

// making import for this since its the easiest to do
function ImportScopeBindings() {
  fetch("./json")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json(); // Parse the JSON response
    })
    .then((jsonData) => {
      // Now you can work with the jsonData object
      console.log(jsonData);
    })
    .catch((error) => {
      console.error("Error fetching/parsing JSON:", error);
    });
}

export { CreateAndExportScopeBindings, CreateScopeBinding, ImportScopeBindings };
