import qai_hub.client as q

def main():
    client = q.Client()

    print("\n📱 AVAILABLE DEVICES:")
    for d in client.get_devices():
        print(f"- {d.name}  (OS: {d.os})")

if __name__ == "__main__":
    main()
