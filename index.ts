import { registerRootComponent } from "expo";

// defines the background call-sync task; Android may start the app just to run it
import "./src/modules/device/backgroundSync";
import App from "./App";

registerRootComponent(App);
