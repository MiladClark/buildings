import path from "node:path";
import { Font } from "@react-pdf/renderer";

Font.register({
  family: "Vazirmatn",
  fonts: [
    {
      src: path.join(
        process.cwd(),
        "public/fonts/vazirmatn/ttf/Vazirmatn-Regular.ttf",
      ),
      fontWeight: 400,
    },
    {
      src: path.join(
        process.cwd(),
        "public/fonts/vazirmatn/ttf/Vazirmatn-Bold.ttf",
      ),
      fontWeight: 700,
    },
  ],
});
