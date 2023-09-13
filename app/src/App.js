import React, { useCallback, useState } from 'react';
//import Modal from 'react-modal';
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';

import ResourceNode from './ResourceNode';
import resourceTypes from './resourceTypes';
import 'reactflow/dist/style.css';
import './overview.css';

import { CreateAndExportServicModel, CreateServiceResourceDefinitions } from "./ServiceModelExporter.ts";
import { CreateAndExportRolloutSpec, CreateOrchestratedStep } from "./RolloutSpecExporter.ts";
import { CreateAndExportScopeBindings, ImportScopeBindings } from "./ScopeBindingsExporter.ts";
import VariableEditor from './VariablesEditor';
import Modal from "@mui/material/Modal";
import JSZip from 'jszip';

const nodeTypes = {
  custom: ResourceNode,
};

const minimapStyle = {
  height: 120,
};


const initialVariableGroups = [
  { name: 'GlobalTags', variables: [{ name: "__RESOURCE_GROUP_NAME__", value: "TestResourceGroup" }, { name: "__LOCATION__", value: "$location()" }] },
  { name: 'KeyVaultTags', variables: [{ name: "__KEYVAULT_NAME__", value: "$config(kv.name)" }, { name: "__FIRST_PARTY_APP_ID_", value: "$config(ownergroupappid)" }] },
  { name: 'StorageAccountTags', variables: [{ name: "__STORAGE_ACCOUNT_NAME__", value: "$location()idmapping" }] }
];

const initialEdges = []

const initialRolloutSpecList = ["Buildout"]

const TestServiceMetadata = {
  serviceSpecificationPath: "ServiceSpec.json",
  serviceIdentifier: "53601923-fb1a-4937-bcf2-ae71190acf34",
  displayName: "Azure Monitor Metrics MetricsRP Buildout-Early",
  serviceGroup: "Microsoft.Azure.AzureMonitorMetrics.MetricsRP.BuildoutEarly",
  environment: "$config(runtimeEnvironment)",
  tenantId: "$config(defaultTenant.id)"
}

const onInit = (reactFlowInstance) => console.log('flow loaded:', reactFlowInstance);

const OverviewFlow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  const [selectedResourceType, setSelectedResourceType] = useState('');
  const [currentRolloutSpec, setCurrentRolloutSpec] = useState(initialRolloutSpecList[0]);
  const [isRolloutSpecModalOpen, setIsRolloutSpecModalOpen] = useState(false); // State to control the modal
  const [rolloutSpecsList, setRolloutSpecsList] = useState(initialRolloutSpecList);
  const [nodeProperties, setNodeProperties] = useState([]);
  const [variableGroups, setVariableGroups] = useState(initialVariableGroups);

  const [isVariableEditorVisible, setIsVariableEditorVisible] = useState(false);

  const handleCreateNode = () => {
    const newNode = {
      id: `node-${nodes.length + 1}`,
      type: 'custom',
      position: { x: 300, y: 100 }, // Set the initial position as needed
      data: {
        resourcetype: selectedResourceType,
        rolloutSpec: currentRolloutSpec,
        setNodeProperties: setNodeProperties,
        nodeProperties: nodeProperties,
        variableGroups: variableGroups,
        deleteNode: deleteNode
      }
    };
    console.log(`creating: ${selectedResourceType}`)
    setNodes((prevNodes) => [...prevNodes, newNode]);
  };

  // Need to fix this, deleted a source node will delete all target nodes
  const deleteNode = (id) => {

    const updatedEdges = edges.filter((edge) => edge.source.id !== id && edge.target.id !== id);
    setEdges(updatedEdges);

    const updatedNodes = nodes.filter((node) => node.id !== id);
    setNodes(updatedNodes); // Update the nodes state
  }

  const handleConfirmRolloutSpec = () => {
    // Handle the creation of the RolloutSpec here
    // For example, update the rolloutSpec state and close the modal
    if (currentRolloutSpec) {
      setRolloutSpecsList((prevRolloutSpecs) => [
        ...prevRolloutSpecs,
        currentRolloutSpec,
      ]);

      setIsRolloutSpecModalOpen(false); // Close the modal
    };
  };

  const ExportToEV2Scripts = async () => {

      // Create folder
      const zip = new JSZip();
  
      // Define your folder structure
      const folder = zip.folder('ServiceGroupRoot');

    var rolloutSpecJson = "";
    var serviceModelJson = "";
    var scopeBindingsJson= "";

    const name = currentRolloutSpec;
    const serviceModelMetadata = TestServiceMetadata;
    const serviceResourceDefinitions = [];
    const orchestratedSteps = [];
    nodes.forEach((node) => {
      // create resourcedef for each resource
      if (node.data.rolloutSpec === currentRolloutSpec) {

        // we probably want to move this processing code elsewhere
        //service model
        const currNodeProperties = nodeProperties[node.id]

        const serviceResourceName = currNodeProperties.targetName;
        const rolloutParameterPath = `Parameters\\${currNodeProperties.templateName}.parameters.json`; // need to parameterize these
        const templatePath = `Templates\\${currNodeProperties.templateName}.arm.template.json`;
        const scopeTags = currNodeProperties.scopeTags;
        const serviceResourceDefinition = CreateServiceResourceDefinitions(serviceResourceName, rolloutParameterPath, templatePath, scopeTags)
        serviceResourceDefinitions.push(serviceResourceDefinition);


        const parametersList = {};
        currNodeProperties.parameters.forEach((parameter) => {
          parametersList[parameter.name] = {
            value: parameter.value
          }
        })
        const parameterJson = {
          $schema: "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
          contentVersion: "1.0.0.0",
          parameters: parametersList
        }
        const parameterJsonString = JSON.stringify(parameterJson, null, 2);
        
        folder.file(`Parameters/${currNodeProperties.templateName}.parameters.json`, parameterJsonString);
        folder.file(`Templates/.${currNodeProperties.templateName}.arm.template.json`, null);

        //rollout spec
        const dependencies = [];
        edges.forEach((edge) => {
          if (edge.target === node.id) {
            const sourceNode = nodes.find((node) => node.id === edge.source);
            if (sourceNode) {
              dependencies.push(nodeProperties[sourceNode.id].stepName);
            }
          }
        });

        const orchestratedStep = CreateOrchestratedStep(currNodeProperties.stepName, "ServiceResourceDefinition", currNodeProperties.targetName, "deploy", dependencies)
        orchestratedSteps.push(orchestratedStep);
      }
    });
    serviceModelJson =  CreateAndExportServicModel(name, serviceModelMetadata, serviceResourceDefinitions, []);
    rolloutSpecJson = CreateAndExportRolloutSpec(name, null, orchestratedSteps);

    //Scope Bindings
    const ScopeBindings = []
    variableGroups.forEach((group) => {
      const BindingList = [];
      group.variables.forEach((variable) => {
        const binding = {
          find: variable.name,
          replaceWith: variable.value,
          fallback: {
            to: ""
          }
        }
        BindingList.push(binding);
      })

      const ScopeBinding = {
        scopeTagName: group.name,
        bindings: BindingList
      }
      ScopeBindings.push(ScopeBinding);
    })

    scopeBindingsJson = CreateAndExportScopeBindings(ScopeBindings);

    folder.file('ScopeBindings.json', scopeBindingsJson);
    folder.file(`RolloutSpec.${name}.json`, rolloutSpecJson);
    folder.file(`ServiceModel.${name}.json`, serviceModelJson);

    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Create a temporary link element and trigger the download
    const url = window.URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ServiceGroupRoot.zip';
    document.body.appendChild(a);
    a.click();

    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    console.log(nodeProperties);
  };

  return (
    <div style={{ height: '97vh' }}>
      <div>
        <select
          value={selectedResourceType}
          onChange={(e) => setSelectedResourceType(e.target.value)}
        >
          <option value="">Select a resource type</option>
          {resourceTypes.map((option, index) => (
            <option key={index} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button onClick={handleCreateNode}>Create Node</button>
        <select
          value={currentRolloutSpec}
          onChange={(e) => setCurrentRolloutSpec(e.target.value)}
        >
          <option value="">Select or Create a RolloutSpec type</option>
          {rolloutSpecsList.map((spec) => (
            <option key={spec} value={spec}>
              {spec}
            </option>
          ))}
        </select>
        <button onClick={() => setIsRolloutSpecModalOpen(true)}>Create RolloutSpec</button>
        <Modal
          open={isRolloutSpecModalOpen}
          onClose={() => setIsRolloutSpecModalOpen(false)}
          aria-labelledby="settings-modal-title"
          aria-describedby="settings-modal-description"
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "auto", // Set the desired width
              backgroundColor: "white",
              padding: "25px",
              borderRadius: "12px",
            }}>
            <h2>Create RolloutSpec</h2>
            <input
              type="text"
              value={currentRolloutSpec}
              onChange={(e) => setCurrentRolloutSpec(e.target.value)}
              placeholder="Enter RolloutSpec name"
            />
            <button onClick={handleConfirmRolloutSpec}>Confirm</button>
            <button onClick={() => setIsRolloutSpecModalOpen(false)}>Cancel</button>
          </div>
        </Modal>
        <button onClick={ExportToEV2Scripts}>Export</button>
        <button onClick={() => setIsVariableEditorVisible(!isVariableEditorVisible)}>
          Toggle Variable Editor
        </button>

        <Modal
          open={isVariableEditorVisible}
          onClose={() => setIsVariableEditorVisible(false)}
          aria-labelledby="settings-modal-title"
          aria-describedby="settings-modal-description"

        >
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "50%", // Set the desired width
            backgroundColor: "white",
            padding: "25px",
            borderRadius: "12px",
          }}>
             
            <VariableEditor groups={variableGroups} setGroups={setVariableGroups} />
          </div>
        </Modal>

      </div>
      <ReactFlow
        nodes={nodes.filter((node) => node.data.rolloutSpec === currentRolloutSpec)}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        attributionPosition="top-right"
        nodeTypes={nodeTypes}
      >
        <Controls />
        <Background color="#aaa" gap={16} />
      </ReactFlow>
    </div>
  );
};

export default OverviewFlow;
