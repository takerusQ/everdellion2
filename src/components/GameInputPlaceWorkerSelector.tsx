import * as React from "react";
import { useRef } from "react";

import { LocationName } from "../model/types";
import { Player } from "../model/player";
import Card from "./Card";

import { useField } from "formik";
import styles from "../styles/GameInputBox.module.css";
import { GameInputType, GameInput } from "../model/types";
import Location from "./Location";

const GameInputPlaceWorkerSelector: React.FC<{
  name: string;
  locations: LocationName[];
  viewingPlayer: Player;
}> = ({ name, locations = [], viewingPlayer }) => {
  const [field, meta, helpers] = useField(name);
  return (
    <div className={styles.selector}>
      <div role="group">
        <p>Choose a location:</p>
        <div className={styles.play_card_list}>
          {locations.map((location, idx) => {
            const isSelected = meta.value === location;
            return (
              <div key={idx} className={styles.play_card_list_item_wrapper}>
                <div
                  key={idx}
                  className={[
                    styles.play_card_list_item,
                    isSelected && styles.play_card_list_item_selected,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    helpers.setValue(location);
                  }}
                >
                  <Location name={location} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GameInputPlaceWorkerSelector;
