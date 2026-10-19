#!/bin/bash
# MYCOFERT Burundi website imagery — earthy organic style (forest green / cream / mushroom brown)
set -e
DIR="/home/z/my-project/public/images"
mkdir -p "$DIR"

STYLE="warm natural professional photography, earthy organic tones, deep forest green and cream color palette, soft golden daylight, African agricultural setting, high quality, detailed, photorealistic"

z-ai image -p "Interior of an oyster mushroom cultivation farm in Africa, rows of vertical substrate bags with clusters of grey oyster mushrooms growing out, $STYLE" -o "$DIR/hero.png" -s 1344x768
z-ai image -p "Freshly harvested grey oyster mushrooms in a woven basket on a rustic wooden table, morning light, $STYLE" -o "$DIR/fresh.png" -s 1024x1024
z-ai image -p "Dried oyster mushrooms in an open kraft paper pouch and glass jars on a wooden table, rustic food styling, $STYLE" -o "$DIR/dried.png" -s 1024x1024
z-ai image -p "Fine beige mushroom powder in a glass jar with a wooden spoon and kraft paper packaging on a wooden table, rustic food styling, $STYLE" -o "$DIR/powder.png" -s 1024x1024
z-ai image -p "Stacks of white ready-to-produce mushroom substrate bags in a clean growing room, prepared for cultivation, $STYLE" -o "$DIR/substrate.png" -s 1024x1024
z-ai image -p "Organic bio-fertilizer presentation, a kraft bag of dark solid compost and a bottle of dark liquid fertilizer beside young green seedlings in rich soil, $STYLE" -o "$DIR/fertilizer.png" -s 1024x1024
z-ai image -p "Close-up of hands holding rich dark compost soil with a young green seedling, mushroom substrate composting in background, circular farming concept, $STYLE" -o "$DIR/sustainability.png" -s 1344x768
z-ai image -p "Group training session on a mushroom farm in Africa, a trainer showing oyster mushrooms growing on substrate bags to young farmers and women attentively learning, $STYLE" -o "$DIR/training.png" -s 1344x768

echo "--- Generated files ---"
ls -la "$DIR"
