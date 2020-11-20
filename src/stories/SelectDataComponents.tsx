import React, { useCallback } from "react";
import Select from "react-select";
import { DataEditor, DataViewer } from "..";
import "react-select/dist/react-select.css";

const OPTIONS = [
  { value: "vanilla", label: "Vanilla" },
  { value: "chocolate", label: "Chocolate" },
  { value: "caramel", label: "Caramel" },
];
const SELECT_WIDTH = 200;

export const SelectView: DataViewer<unknown, unknown> = ({
  cell,
  row,
  column,
  getValue,
}) => (
  <Select
    value={getValue({ data: cell, row, column })}
    options={OPTIONS}
    disabled
    style={{ width: 200 }}
  />
);

export const SelectEdit: DataEditor<{}, unknown> = ({
  cell,
  onChange,
  getValue,
  column,
  row,
}) => {
  const handleChange = useCallback(
    (selection) => {
      onChange({ ...cell, value: selection ? selection.value : null });
    },
    [cell, onChange]
  );
  const value = getValue({ column, row, data: cell }) || 0;
  return (
    <Select
      value={value}
      onChange={handleChange}
      options={OPTIONS}
      style={{ width: SELECT_WIDTH }}
    />
  );
};
