from printfleet2.app import create_app


def main() -> None:
    app = create_app()
    debug = bool(app.config.get("DEBUG"))
    app.run(host="0.0.0.0", port=8080, debug=debug)


if __name__ == "__main__":
    main()
