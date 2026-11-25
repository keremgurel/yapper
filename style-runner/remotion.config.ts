import { Config } from "@remotion/cli/config";
import { useOneReact } from "./webpack-override.ts";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
Config.overrideWebpackConfig(useOneReact);
