// @flow

import React, { PureComponent } from "react";
import type { ComponentType } from "react";
import createStore from "unistore";
import devtools from "unistore/devtools";
import { Provider, connect } from "unistore/react";
import clipboard from "clipboard-polyfill";
import * as Types from "./types";
import Table from "./Table";
import type { Props as TableProps } from "./Table";
import Row from "./Row";
import type { Props as RowProps } from "./Row";
import { Cell, enhance as enhanceCell } from "./Cell";
import type { Props as CellProps } from "./Cell";
import DataViewer from "./DataViewer";
import DataEditor from "./DataEditor";
import ActiveCell from "./ActiveCell";
import Selected from "./Selected";
import Copied from "./Copied";
import { range, updateData } from "./util";
import * as PointSet from "./point-set";
import * as PointMap from "./point-map";
import * as Matrix from "./matrix";
import * as Actions from "./actions";
import "./Spreadsheet.css";

declare class ClipboardEvent extends Event {
  clipboardData: DataTransfer;
}

type DefaultCellType = {
  value: string | number | boolean | null
};

const getValue = ({ data }: { data: DefaultCellType }) => data.value;

type Props<CellType, Value> = {|
  data: Matrix.Matrix<CellType>,
  Table: ComponentType<TableProps>,
  Row: ComponentType<RowProps>,
  Cell: ComponentType<CellProps<CellType, Value>>,
  DataViewer: Types.DataEditor<CellType, Value>,
  DataEditor: Types.DataViewer<CellType, Value>,
  getValue: Types.getValue<Cell, Value>
|};

type EventProps<CellType> = {|
  onChange: (data: Matrix.Matrix<CellType>) => void,
  onModeChange: (mode: Types.Mode) => void,
  onSelect: (selected: Types.Point[]) => void,
  onActivate: (active: Types.Point) => void
|};

type State = {|
  rows: number,
  columns: number
|};

type Handlers = {|
  handleKeyPress: (event: SyntheticKeyboardEvent<*>) => void,
  handleKeyDown: (event: SyntheticKeyboardEvent<*>) => void
|};

const Spreadsheet = <CellType, Value>({
  Table,
  Row,
  Cell,
  DataViewer,
  getValue,
  rows,
  columns,
  handleKeyPress,
  handleKeyDown
}: {|
  ...$Diff<Props<CellType, Value>, {| data: Matrix.Matrix<CellType> |}>,
  ...State,
  ...Handlers
|}) => (
  <div
    className="Spreadsheet"
    onKeyPress={handleKeyPress}
    onKeyDown={handleKeyDown}
  >
    <Table>
      {range(rows).map(rowNumber => (
        <Row key={rowNumber}>
          {range(columns).map(columnNumber => (
            <Cell
              key={columnNumber}
              row={rowNumber}
              column={columnNumber}
              DataViewer={DataViewer}
              getValue={getValue}
            />
          ))}
        </Row>
      ))}
    </Table>
    <ActiveCell DataEditor={DataEditor} getValue={getValue} />
    <Selected />
    <Copied />
  </div>
);

Spreadsheet.defaultProps = {
  Table,
  Row,
  /** @todo enhance incoming Cell prop */
  Cell: enhanceCell(Cell),
  DataViewer,
  DataEditor,
  getValue
};

const mapStateToProps = ({ data }: Types.StoreState<*>): State =>
  Matrix.getSize(data);

type KeyDownHandler<Cell> = (
  state: Types.StoreState<Cell>,
  event: SyntheticKeyboardEvent<*>
) => $Shape<Types.StoreState<Cell>>;

type KeyDownHandlers<Cell> = {
  [eventType: string]: KeyDownHandler<Cell>
};

const go = (rowDelta: number, columnDelta: number): KeyDownHandler<*> => (
  state,
  event
) => {
  if (!state.active) {
    return null;
  }
  const nextActive = {
    row: state.active.row + rowDelta,
    column: state.active.column + columnDelta
  };
  if (!Matrix.has(nextActive.row, nextActive.column, state.data)) {
    return { mode: "view" };
  }
  return {
    active: nextActive,
    selected: PointSet.from([nextActive]),
    mode: "view"
  };
};

/** @todo replace to real func */
const cellFromValue = value => ({ value });

/** @todo handle inactive state? */
const keyDownHandlers: KeyDownHandlers<*> = {
  ArrowUp: go(-1, 0),
  ArrowDown: go(+1, 0),
  ArrowLeft: go(0, -1),
  ArrowRight: go(0, +1),
  Tab: go(0, +1),
  Enter: (state, event) => ({
    mode: "edit"
  }),
  Backspace: (state, event) => {
    if (!state.active) {
      return null;
    }
    return {
      data: PointSet.reduce(
        (acc, point) =>
          updateData(acc, {
            ...point,
            data: cellFromValue("")
          }),
        state.selected,
        state.data
      )
    };
  }
};

const editKeyDownHandlers: KeyDownHandlers<*> = {
  Escape: (state, event) => ({
    mode: "view"
  }),
  Tab: keyDownHandlers.Tab,
  Enter: keyDownHandlers.ArrowDown
};

const modifyEdge = (field: $Keys<Types.Point>, delta: number) => (
  state,
  event
) => {
  const edgeOffsets = PointSet.has(state.selected, {
    ...state.active,
    [field]: state.active[field] + delta * -1
  });

  const nextSelected = edgeOffsets
    ? PointSet.shrinkEdge(state.selected, field, delta * -1)
    : PointSet.extendEdge(state.selected, field, delta);

  /** @todo make sure it performs well */
  return {
    selected: PointSet.filter(
      point => Matrix.has(point.row, point.column, state.data),
      nextSelected
    )
  };
};

const shiftKeyDownHandlers: KeyDownHandlers<*> = {
  ArrowUp: modifyEdge("row", -1),
  ArrowDown: modifyEdge("row", 1),
  ArrowLeft: modifyEdge("column", -1),
  ArrowRight: modifyEdge("column", 1)
};

function actions<CellType>(store) {
  return {
    handleKeyPress(state: Types.StoreState<CellType>) {
      if (state.mode === "view" && state.active) {
        return { mode: "edit" };
      }
      return null;
    },
    handleKeyDown(
      state: Types.StoreState<CellType>,
      event: SyntheticKeyboardEvent<HTMLElement>
    ) {
      const { key, nativeEvent } = event;
      let handlers;
      // Order matters
      if (state.mode === "edit") {
        handlers = editKeyDownHandlers;
      } else if (event.shiftKey) {
        handlers = shiftKeyDownHandlers;
      } else {
        handlers = keyDownHandlers;
      }
      const handler = handlers[key];
      if (handler) {
        nativeEvent.preventDefault();
        return handler(state, event);
      }
      return null;
    }
  };
}

const ConnectedSpreadsheet = connect(mapStateToProps, actions)(Spreadsheet);

const initialState: $Shape<Types.StoreState<*>> = {
  selected: PointSet.from([]),
  copied: PointSet.from([]),
  active: null,
  mode: "view",
  cellDimensions: PointMap.from([])
};

type Unsubscribe = () => void;

type WrapperProps<CellType, Value> = Props<CellType, Value> &
  EventProps<CellType>;

export default class SpreadsheetWrapper<CellType, Value> extends PureComponent<
  WrapperProps<CellType, Value>
> {
  store: Object;
  unsubscribe: Unsubscribe;
  prevState: Types.StoreState<CellType>;

  static defaultProps = {
    onChange: () => {},
    onModeChange: () => {},
    onSelect: () => {},
    onActivate: () => {}
  };

  constructor(props: WrapperProps<CellType, Value>) {
    super(props);
    const state: Types.StoreState<CellType> = {
      ...initialState,
      data: this.props.data
    };
    this.store =
      process.env.NODE_ENV === "production"
        ? createStore(state)
        : devtools(createStore(state));
    this.prevState = state;
  }

  componentDidMount() {
    const { onChange, onModeChange, onSelect, onActivate } = this.props;
    this.unsubscribe = this.store.subscribe(
      (state: Types.StoreState<CellType>) => {
        const { prevState } = this;
        if (state.data !== prevState.data) {
          onChange(state.data);
        }
        if (state.mode !== prevState.mode) {
          onModeChange(state.mode);
        }
        if (state.selected !== prevState.selected) {
          onSelect(PointSet.toArray(state.selected));
        }
        if (state.active !== prevState.active && state.active) {
          onActivate(state.active);
        }
        this.prevState = state;
      }
    );
    document.addEventListener("copy", (event: ClipboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      this.handleCopy(event);
    });
    document.addEventListener("cut", (event: ClipboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      this.handleCut(event);
    });
    document.addEventListener("paste", (event: ClipboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      this.handlePaste(event);
    });
  }

  handleCopy = (event: ClipboardEvent) => {
    const { data, selected } = this.store.getState();
    const matrix = PointSet.toMatrix(selected, data);
    const filteredMatrix = Matrix.filter(Boolean, matrix);
    const valueMatrix = Matrix.map(getValue, filteredMatrix);
    const copy = () => clipboard.writeText(Matrix.join(valueMatrix));
    if (navigator.permissions) {
      navigator.permissions
        .query({
          name: "clipboard-read"
        })
        .then(readClipboardStatus => {
          if (readClipboardStatus.state) {
            copy();
          }
        });
    } else {
      copy();
    }
    this.store.setState({ copied: selected, cut: false, hasPasted: false });
  };

  handleCut = (event: ClipboardEvent) => {
    this.handleCopy(event);
    this.store.setState({ cut: true });
  };

  handlePaste = (event: ClipboardEvent) => {
    const prevState = this.store.getState();
    const minRow = PointSet.getEdgeValue(prevState.copied, "row", -1);
    const minColumn = PointSet.getEdgeValue(prevState.copied, "column", -1);
    const { data, selected } = PointSet.reduce(
      (acc, { row, column }) => {
        const nextRow = row - minRow + prevState.active.row;
        const nextColumn = column - minColumn + prevState.active.column;

        const nextPointExists = Matrix.has(nextRow, nextColumn, prevState.data);

        if (!nextPointExists) {
          return acc;
        }

        const nextData = Matrix.set(
          nextRow,
          nextColumn,
          Matrix.get(row, column, prevState.data),
          acc.data
        );
        const nextSelected = PointSet.add(acc.selected, {
          row: nextRow,
          column: nextColumn
        });

        return { data: nextData, selected: nextSelected };
      },
      prevState.copied,
      { data: prevState.data, selected: PointSet.from([]) }
    );
    this.store.setState({
      data,
      selected,
      cut: false,
      hasPasted: true,
      mode: "view"
    });
  };

  componentDidUpdate(prevProps: Props<CellType, Value>) {
    if (prevProps.data !== this.props.data) {
      this.store.setState({ data: this.props.data });
    }
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  render() {
    const { data, ...rest } = this.props;
    return (
      <Provider store={this.store}>
        <ConnectedSpreadsheet {...rest} />
      </Provider>
    );
  }
}
