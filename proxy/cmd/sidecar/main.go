package main

import (
	"os"

	"dual-dns-browser/internal/proxy"
)

func main() {
	proxy.Run(os.Args[1:])
}
