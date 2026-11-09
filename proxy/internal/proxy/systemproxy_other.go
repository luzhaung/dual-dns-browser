//go:build !darwin && !windows

package proxy

func systemHTTPProxy() string {
	return ""
}
