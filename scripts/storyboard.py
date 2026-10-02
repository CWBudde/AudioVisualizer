"""Contact sheet for reviewing captured Remotion frames; labels stay out of video."""
from pathlib import Path
from PIL import Image, ImageDraw

paths = sorted(p for p in Path('out/stills').glob('*.png') if p.stem.isdigit())
sheet = Image.new('RGB', (5 * 270, 4 * 292), '#060814')
draw = ImageDraw.Draw(sheet)
for i, path in enumerate(paths):
    x, y = (i % 5) * 270, (i // 5) * 292
    sheet.paste(Image.open(path).convert('RGB').resize((270, 270)), (x, y))
    draw.text((x + 10, y + 274), f'{int(path.stem) / 60:.2f}s', fill='#B9C9E5')
sheet.save('out/storyboard.jpg', quality=94)
