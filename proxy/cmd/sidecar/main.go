package main

import (
	"os"

	"dual-dns-browser/internal/lan"
	"dual-dns-browser/internal/proxy"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "lan" {
		lan.Run(os.Args[2:])
		return
	}
	proxy.Run(os.Args[1:])
}
