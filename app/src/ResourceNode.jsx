import React, { useState, useEffect } from "react";
import { Handle, Position } from "reactflow";
import JSONInput from "react-json-editor-ajrm";
import "./ResourceNode.css";
import axios from "axios";
//import Modal from "react-modal"; // Import the react-modal library
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { TextField } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import SettingsIcon from "@mui/icons-material/Settings";
import Modal from "@mui/material/Modal";
import CloseIcon from "@mui/icons-material/Close";
import Typography from "@mui/material/Typography";

function ResourceNode({ id, x, y, data }) {
  const [resourceType, setResourceType] = useState(data.resourcetype);
  const [resourceName, setResourceName] = useState("resourceName");
  const [template, setTemplate] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [selectedVariableGroups, setSelectedVariableGroups] = useState([]);
  const [selectedVariableGroup, setSelectedVariableGroup] = useState("");
  const [targetName, setTargetName] = useState("");
  const [orchestratedStepName, setOrchestratedStepName] = useState("");

  useEffect(() => {
    if (template == null) {
      // Fetch JSON template from the API
      axios
        .get(
          `http://localhost:3001/api/armtemplate?resource=${data.resourcetype}`
        )
        .then((response) => {
          setTemplate(response.data);
          console.log(response.data);
        })
        .then(() => {
          setResourceName(template.name);
        })
        .catch((error) => {
          console.error("Error fetching template:", error);
        });
    }
  }, []);

  const handleAddVariableGroup = () => {
    if (selectedVariableGroup) {
      setSelectedVariableGroups([
        ...selectedVariableGroups,
        selectedVariableGroup,
      ]);
      setSelectedVariableGroup(""); // Clear the selected group
    }
  };

  const updateTemplate = (newTemplate) => {
    setTemplate(newTemplate.jsObject);
    console.log("CHange");
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    updateProperties();
  };

  const updateProperties = () => {
    const currProperties = data.nodeProperties;
    const newProperties = {
        stepName: orchestratedStepName,
        targetName: targetName,
        template: template,
        scopeTags: selectedVariableGroups
      };
      currProperties[id] = newProperties;
  
      // Call the callback function to update properties in the parent component
      if (data.setNodeProperties) {
        data.setNodeProperties(currProperties);
      }
  }

  const deleteResource = () => {
    data.deleteNode(id);
  };

  return (
    <>
      <div
        className="custom-node__header"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TextField
          id="standard-basic"
          label="Target Name"
          variant="standard"
          onChange={(e) => {setTargetName(e.target.value); updateProperties()}}
          inputProps={{ style: { fontSize: 9 } }} // font size of input text
          InputLabelProps={{ style: { fontSize: 9 } }} // font size of input label
        />

        <IconButton
          style={{
            borderRadius: "50%", // Set the border radius to make it round
            backgroundColor: "#e0e0e0", // Set the background color
            padding: "8px", // Add some padding to the button
            width: "15px",
            height: "15px",
          }}
          onClick={() => setIsSettingsOpen(true)}
        >
          <SettingsIcon sx={{ fontSize: 12 }} />
        </IconButton>
        <IconButton
          style={{
            borderRadius: "50%", // Set the border radius to make it round
            backgroundColor: "#e0e0e0", // Set the background color
            padding: "8px", // Add some padding to the button
            width: "15px",
            height: "15px",
          }}
          color="error"
          onClick={deleteResource}
        >
          <DeleteIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </div>
      <div className="custom-node__body">
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Typography variant="caption"></Typography>
          <span style={{ fontSize: 7 }}>{resourceType}</span>
          <TextField
            id="standard-basic"
            label="Step Name"
            variant="standard"
            onChange={(e) =>{setOrchestratedStepName(e.target.value); updateProperties()}}
            inputProps={{ style: { fontSize: 9 } }} // font size of input text
            InputLabelProps={{ style: { fontSize: 9 } }} // font size of input label
            style={{ marginBottom: "8px", width: "70%" }}
          />
        </div>

        {/* We may want to move all this settings code into separate component */}
        <Modal
          open={isSettingsOpen}
          onClose={handleCloseSettings}
          aria-labelledby="settings-modal-title"
          aria-describedby="settings-modal-description"
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "80%", // Set the desired width
              backgroundColor: "white",
              padding: "25px",
              borderRadius: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2>Settings</h2>
              <IconButton
                style={{
                  borderRadius: "50%", // Set the border radius to make it round
                  backgroundColor: "#e0e0e0", // Set the background color
                  padding: "8px", // Add some padding to the button
                  width: "40px",
                  height: "40px",
                }}
                onClick={handleCloseSettings}
              >
                <CloseIcon sx={{ fontSize: 30 }} />
              </IconButton>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-evenly",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <h5>Parameters</h5>
                <div>
                  <label htmlFor="variableGroupSelect">
                    Select Scope Tag:{" "}
                  </label>
                  <select
                    id="variableGroupSelect"
                    value={selectedVariableGroup}
                    onChange={(e) => setSelectedVariableGroup(e.target.value)}
                  >
                    <option value="">Select a Scope Tag</option>
                    {data.variableGroups.map((group) => (
                      <option key={group.name} value={group.name}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={handleAddVariableGroup}>
                    Add Scope Tag
                  </button>
                </div>
                <div>
                  <h5>Scope Tags</h5>
                  <ul>
                    {selectedVariableGroups.map((group) => (
                      <li key={group}>{group}</li>
                    ))}
                  </ul>
                </div>
                <span>
                  Create a UI for editing the parameters and pulling in scope{" "}
                </span>
                <span>
                  {" "}
                  bindings variables that can be used in the arm template
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <h5>Arm Template</h5>
                <JSONInput placeholder={template} onChange={updateTemplate} />
              </div>
            </div>
          </div>
        </Modal>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        onConnect={(params) => console.log("handle onConnect", params)}
        isConnectable="true"
      />
      <Handle
        type="source"
        position={Position.Right}
        onConnect={(params) => console.log("handle onConnect", params)}
        isConnectable="true"
      />
    </>
  );
}

export default ResourceNode;
