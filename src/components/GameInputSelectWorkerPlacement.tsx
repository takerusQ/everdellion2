import * as React from "react";
import { useRef } from "react";

import { GameInputSelectWorkerPlacement as TGameInputSelectWorkerPlacement } from "../model/types";
import { Player } from "../model/player";
import { ResourcesForm } from "./CardPayment";
import { useField } from "formik";
import isEqual from "lodash/isEqual";

const GameInputSelectWorkerPlacement: React.FC<{
  gameInput: TGameInputSelectWorkerPlacement;
  viewingPlayer: Player;
}> = ({ gameInput, viewingPlayer }) => {
  const [field, meta, helpers] = useField(
    "gameInput.clientOptions.selectedInput"
  );
  return (
    <>
      <p>Choose a worker</p>
      <>
        <ul>
          {gameInput.options.map((workerOption: any, idx) => {
            return (
              <li
                key={idx}
                onClick={() => {
                  if (!isEqual(meta.value, workerOption)) {
                    helpers.setValue(workerOption);
                  } else {
                    helpers.setValue(null);
                  }
                }}
              >
                {workerOption.location ||
                  workerOption.event ||
                  workerOption.card}
              </li>
            );
          })}
        </ul>
      </>
    </>
  );
};

export default GameInputSelectWorkerPlacement;
