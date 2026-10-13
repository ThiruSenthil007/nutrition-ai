type Detection = {
  score: number;
  label: string;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
};

type Detector = (image: string, options: { threshold: number }) => Promise<Detection[]>;
type Classification = { score: number; label: string };
type ZeroShotClassifier = (image: string, labels: string[]) => Promise<Classification[]>;

export type FoodObjectDetection = Detection;

const foodLabels = new Set([
  "apple",
  "banana",
  "broccoli",
  "carrot",
  "cake",
  "donut",
  "hot dog",
  "orange",
  "pizza",
  "sandwich",
]);

const dishPrompts: Record<string, string> = {
  "a plate of chicken mandi with spiced rice and roasted chicken": "Chicken Mandi",
  "a plate of mutton mandi with spiced rice and roasted lamb": "Mutton Mandi",
  "a plate of beef mandi with spiced rice and roasted beef": "Beef Mandi",
  "a plate of chicken biryani with basmati rice": "Chicken Biryani",
  "a plate of mutton biryani with basmati rice": "Mutton Biryani",
  "a plate of vegetable biryani with basmati rice": "Vegetable Biryani",
  "a plate of chicken kabsa with rice": "Chicken Kabsa",
  "a plate of mutton kabsa with rice": "Mutton Kabsa",
  "a plate of grilled chicken served with rice": "Grilled Chicken with Rice",
  "a plate of lamb kebab served with rice": "Lamb Kebab with Rice",
  "a bowl of dal and rice": "Dal Chawal",
  "a plate of chicken curry served with rice": "Chicken Curry with Rice",
  "a plate of butter chicken served with rice": "Butter Chicken with Rice",
  "a plate of chicken shawarma with rice": "Chicken Shawarma with Rice",
  "a plate of vegetable pulao": "Vegetable Pulao",
  "a plate of fried rice": "Fried Rice",
  "a plate of idli with sambar": "Idli with Sambar",
  "a plate of masala dosa": "Masala Dosa",
  "a plate of vegetable poha": "Vegetable Poha",
  "a bowl of ven pongal": "Ven Pongal",
  "a plate of fish curry with rice": "Fish Curry with Rice",
  "a plate of pizza": "Pizza",
  "a bowl of pasta": "Pasta",
  "a plate of salad": "Salad",
};

let detectorPromise: Promise<Detector> | undefined;
let classifierPromise: Promise<ZeroShotClassifier> | undefined;

function assertRasterImageData(imageData: string) {
  if (!/^data:image\/(?:png|jpe?g|webp|gif|bmp);base64,/i.test(imageData)) {
    throw new Error("Image analysis requires a base64 raster image upload");
  }
}

async function getDetector() {
  detectorPromise ??= import("@huggingface/transformers").then(async ({ pipeline }) =>
    await pipeline("object-detection", "Xenova/detr-resnet-50") as unknown as Detector
  );

  try {
    return await detectorPromise;
  } catch (error) {
    detectorPromise = undefined;
    throw error;
  }
}

export async function detectFoodObjects(imageData: string): Promise<FoodObjectDetection[]> {
  assertRasterImageData(imageData);
  const detector = await getDetector();
  const detections = await detector(imageData, { threshold: 0.3 });
  return detections
    .filter(detection => foodLabels.has(detection.label.toLowerCase()))
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);
}

export async function classifyFoodDish(imageData: string) {
  assertRasterImageData(imageData);
  classifierPromise ??= import("@huggingface/transformers").then(async ({ pipeline }) =>
    await pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32") as unknown as ZeroShotClassifier
  );

  try {
    const classifier = await classifierPromise;
    const predictions = await classifier(imageData, Object.keys(dishPrompts));
    const bestMatch = predictions[0];
    return bestMatch ? { dishName: dishPrompts[bestMatch.label] ?? bestMatch.label, score: bestMatch.score } : null;
  } catch (error) {
    classifierPromise = undefined;
    throw error;
  }
}