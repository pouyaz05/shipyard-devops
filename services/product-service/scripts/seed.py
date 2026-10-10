"""Seed demo data. Run manually (never on app startup):

    DATABASE_URL=... python -m scripts.seed

Safe to run twice: existing categories and SKUs are skipped.
"""
import os

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.slug import slugify
from app.models import Category, Product

CATEGORIES = [
    ("Microcontrollers", "microcontrollers"),
    ("Sensors", "sensors"),
    ("Components & Kits", "components-kits"),
]

# sku, name, description, price_cents, stock, category slug (demo prices)
_ROWS = [
    ("ARD-UNO-R3", "Arduino Uno R3", "ATmega328P board with USB-B connector, the classic starter board.", 2760, 40, "microcontrollers"),
    ("ARD-NANO", "Arduino Nano", "Compact ATmega328P board in a breadboard-friendly form factor.", 2400, 35, "microcontrollers"),
    ("ESP32-DEVKIT-V1", "ESP32 DevKit V1", "Dual-core ESP32 board with Wi-Fi and Bluetooth, 30 pins.", 899, 80, "microcontrollers"),
    ("RPI-PICO", "Raspberry Pi Pico", "RP2040 microcontroller board with 2 MB flash.", 400, 60, "microcontrollers"),
    ("SEN-DHT22", "DHT22 Temperature and Humidity Sensor", "Digital sensor, -40 to 80 C and 0 to 100 percent RH.", 650, 50, "sensors"),
    ("SEN-HCSR04", "HC-SR04 Ultrasonic Distance Sensor", "Measures distance from 2 cm to 400 cm.", 300, 70, "sensors"),
    ("SEN-BMP280", "BMP280 Barometric Pressure Sensor", "I2C and SPI pressure and temperature sensor module.", 450, 45, "sensors"),
    ("SEN-PIR-HCSR501", "HC-SR501 PIR Motion Sensor", "Passive infrared motion detector with adjustable range.", 350, 55, "sensors"),
    ("KIT-RES-600", "Resistor Kit 600 pcs", "30 values of 1/4 W resistors, 20 pieces each.", 1299, 30, "components-kits"),
    ("CMP-BB-830", "Breadboard 830 Points", "Full-size solderless breadboard.", 599, 90, "components-kits"),
    ("CMP-JUMP-120", "Jumper Wire Set 120 pcs", "Male-to-male, male-to-female and female-to-female wires.", 699, 65, "components-kits"),
    ("KIT-LED-500", "LED Assortment Kit 500 pcs", "Five colors of 5 mm LEDs, 100 pieces each.", 999, 40, "components-kits"),
]
PRODUCTS = [
    {
        "sku": sku,
        "name": name,
        "slug": slugify(name),
        "description": description,
        "price_cents": price_cents,
        "stock": stock,
        "category": category,
    }
    for sku, name, description, price_cents, stock, category in _ROWS
]


def seed(engine) -> int:
    """Insert missing categories and products. Returns the number of new products."""
    with Session(engine) as db:
        categories: dict[str, Category] = {}
        for name, slug in CATEGORIES:
            category = db.scalar(select(Category).where(Category.slug == slug))
            if category is None:
                category = Category(name=name, slug=slug)
                db.add(category)
            categories[slug] = category
        db.flush()

        created = 0
        for item in PRODUCTS:
            if db.scalar(select(Product.id).where(Product.sku == item["sku"])) is None:
                data = {k: v for k, v in item.items() if k != "category"}
                db.add(Product(**data, category=categories[item["category"]]))
                created += 1
        db.commit()
        return created


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is not set")
    print(f"Seed finished: {seed(create_engine(url))} new products")


if __name__ == "__main__":
    main()
