import React, { useCallback, useState } from 'react';
import Modal from 'react-modal';
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
import VariableEditor from './VariablesEditor';

const nodeTypes = {
  custom: ResourceNode,
};

const minimapStyle = {
  height: 120,
};


const initialVariableGroups = [
  { name: 'Global', variables: [{ name: "ResourceGroupName", value: "TestResourceGroup" }] }
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

  const ExportToEV2Scripts = () => {
    const name = currentRolloutSpec;
    const serviceModelMetadata = TestServiceMetadata;
    const serviceResourceDefinitions = [];
    const orchestratedSteps = [];
    nodes.forEach((node) => {
      // create resourcedef for each resource
      if (node.data.rolloutSpec === currentRolloutSpec) {

        // we probably want to move this processing code elsewhere
        //service model
        const serviceResourceName = nodeProperties[node.id].targetName;
        const rolloutParameterPath = "Parameters\\Keyvault.arm.template.json"; // need to parameterize these
        const templatePath = "Templates\\Keyvault.arm.template.json";
        const scopeTags = nodeProperties[node.id].scopeTags;
        const serviceResourceDefinition = CreateServiceResourceDefinitions(serviceResourceName, rolloutParameterPath, templatePath, scopeTags)
        serviceResourceDefinitions.push(serviceResourceDefinition);

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

        const orchestratedStep = CreateOrchestratedStep(nodeProperties[node.id].stepName, "ServiceResourceDefinition", nodeProperties[node.id].targetName, "deploy", dependencies)
        orchestratedSteps.push(orchestratedStep);
      }
    });
    CreateAndExportServicModel(name, serviceModelMetadata, serviceResourceDefinitions, []);
    CreateAndExportRolloutSpec(name, null, orchestratedSteps);


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
          isOpen={isRolloutSpecModalOpen}
          onRequestClose={() => setIsRolloutSpecModalOpen(false)}
          contentLabel="Create RolloutSpec Modal"
          style={{
            content: {
              width: '50%',
              height: '30%',
              margin: 'auto',
            },
          }}
        >
          <h2>Create RolloutSpec</h2>
          <input
            type="text"
            value={currentRolloutSpec}
            onChange={(e) => setCurrentRolloutSpec(e.target.value)}
            placeholder="Enter RolloutSpec name"
          />
          <button onClick={handleConfirmRolloutSpec}>Confirm</button>
          <button onClick={() => setIsRolloutSpecModalOpen(false)}>Cancel</button>
        </Modal>
        <button onClick={ExportToEV2Scripts}>Export</button>
        <button onClick={() => setIsVariableEditorVisible(!isVariableEditorVisible)}>
        Toggle Variable Editor
        </button>
        {isVariableEditorVisible && (
        <div class="overlay">
          <div class="overlay-content">
          <VariableEditor groups={variableGroups} setGroups={setVariableGroups} />
          </div>
        </div>
        )}
        
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
