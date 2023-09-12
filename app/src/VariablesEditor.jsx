import React, { useState } from "react";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { TextField } from "@mui/material";
import Box from "@mui/material/Box";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";

const VariableEditor = ({ groups, setGroups }) => {
  const [variableName, setVariableName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [variableValue, setVariableValue] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  const handleGroupChange = (e) => {
    setSelectedGroup(e.target.value);
  };

  const handleVariableAdd = () => {
    // Find the selected group by name
    const group = groups.find((g) => g.name === selectedGroup);

    if (group) {
      // Add the variable to the group and clear the input fields
      group.variables.push({ name: variableName, value: variableValue });
      setVariableName("");
      setVariableValue("");
    }
  };

  const handleVariableRemove = (groupName, variableName) => {
    const groupIndex = groups.findIndex((g) => g.name === groupName);

    if (groupIndex !== -1) {
      const updatedGroups = [...groups];
      const group = updatedGroups[groupIndex];

      // Remove the variable from the group
      group.variables = group.variables.filter(
        (variable) => variable.name !== variableName
      );

      // Update the state with the modified groups
      setGroups(updatedGroups);
    }
  };

  const handleCreateGroup = () => {
    if (newGroupName.trim() === "") {
      return;
    }

    // Check if a group with the same name already exists
    if (groups.some((group) => group.name === newGroupName)) {
      alert("A group with the same name already exists.");
      return;
    }

    // Create a new group and update the state
    setGroups([...groups, { name: newGroupName, variables: [] }]);
    setSelectedGroup(newGroupName);
    setNewGroupName("");
  };

  const handleDeleteGroup = () => {
    if (selectedGroup === "") {
      return;
    }

    // Filter out the selected group from the groups array and update the state
    setGroups(groups.filter((group) => group.name !== selectedGroup));
    setSelectedGroup("");
  };

  return (
    <div>
      <h3>Variable Groups</h3>
      <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
        <InputLabel id="demo-simple-select-standard-label">
          Select Group
        </InputLabel>
        <Select
          id="groupSelect"
          inputLabel="Select a group"
          label="Select Group"
          value={selectedGroup}
          onChange={handleGroupChange}
        >
          <MenuItem value="">
            <em>Select a group</em>
          </MenuItem>
          {groups.map((group, index) => (
            <MenuItem key={index} value={group.name}>
              {group.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Box
        component="form"
        sx={{
          "& > :not(style)": { m: 1, width: "25ch" },
        }}
        noValidate
        autoComplete="off"
      >
        <TextField
          value={newGroupName}
          id="standard-basic"
          label="New Group Name"
          variant="standard"
          onChange={(e) => setNewGroupName(e.target.value)}
        />
        <IconButton
          variant="contained"
          color="primary"
          onClick={handleCreateGroup}
          style={{
            borderRadius: "50%", // Set the border radius to make it round
            padding: "8px", // Add some padding to the button
            width: "35px",
            height: "35px",
          }}
        >
          <AddIcon sx={{ fontSize: 25 }} />
        </IconButton>
        <IconButton
          variant="contained"
          color="error"
          onClick={handleDeleteGroup}
          style={{
            borderRadius: "50%", // Set the border radius to make it round
            padding: "8px", // Add some padding to the button
            width: "35px",
            height: "35px",
          }}
        >
          <DeleteIcon sx={{ fontSize: 25 }} />
        </IconButton>
      </Box>

      {selectedGroup && (
        <div>
          <h4>Variables in {selectedGroup}</h4>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex" }}>
              <TextField
                label="Variable Name"
                variant="standard"
                value={variableName}
                onChange={(e) => setVariableName(e.target.value)}
                style={{ marginRight: "10px" }}
              />
              <TextField
                label="Variable Value"
                variant="standard"
                value={variableValue}
                onChange={(e) => setVariableValue(e.target.value)}
                style={{ marginRight: "10px" }}
              />
              <IconButton
                variant="contained"
                color="primary"
                onClick={handleVariableAdd}
                style={{
                  borderRadius: "50%", // Set the border radius to make it round
                  padding: "8px", // Add some padding to the button
                  width: "35px",
                  height: "35px",
                }}
              >
                <AddIcon sx={{ fontSize: 25 }} />
              </IconButton>
            </div>
            <List>
              {groups
                .find((g) => g.name === selectedGroup)
                ?.variables.map((variable, index) => (
                  <ListItem key={index}>
                    <div style={{ width: "50%" }}>
                      <ListItemText
                        primary={`${variable.name}: ${variable.value}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() =>
                            handleVariableRemove(selectedGroup, variable.name)
                          }
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </div>
                  </ListItem>
                ))}
            </List>
          </div>
        </div>
      )}
    </div>
  );
};

export default VariableEditor;
