# Local Development

## Pre-requisites
1. Host machine should be able to give access of `cgoupsv1` , if not follow a 
development hack, 
```bash
launch focal --name judge0-vm --cpus 2 --memory 4G --disk 10G
```

## Steps

1. Install docker( desktop ) https://docs.docker.com/desktop/setup/install/linux/ubuntu/
2. Install kind and kubectl 
  - https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/  
  - https://kind.sigs.k8s.io/docs/user/quick-start/#installation

3. Fork the repo https://github.com/AyushK101/AlgoForge.git

4. Install helm  https://helm.sh/docs/intro/install/
5. Install ingress controller repo:-
```bash
 helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 
```


6. Start cluster with cluster config
```bash
kind create cluster --name algoforge-cluster --config clusters.yml
```


7. Create ingress controller -- with a NodePort (hack for loadbalancer )
> on local this will expose a NodePort, 
```bash
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.service.type=NodePort \
  --set controller.service.nodePorts.http=30080 \
  --set controller.service.nodePorts.https=30443
```

8. If you have local images , then load them into the Docker Demon of k8 nodes
```bash
- kind load docker-image <image-name>:<tag> --name <cluster-name>
```

9. Confirm if pod is using local image or not:
```bash
kubectl describe pod <pod-name> | grep Image
```
OR   confirm by exec into nodes with `crictl` 

10. Apply configs 
```bash
ubuntu@judge0-vm:~/AlgoForge/judge0$ kubectl apply -f confgiMaps.yml 
configmap/next-config created
configmap/judge0conf-config created

```

11. Apply master manifest.yml
```bash
kubectl apply -f manifest.yml
```
## flow: 
```
[HOST: web.local:30080]
     ↓ (via /etc/hosts → VM IP)
[VM: 10.130.253.46:30080]
     ↓ (via Docker port map)
[Kind Container:30080]
     ↓ (via NodePort svc)
[NGINX Ingress Controller:80]
     ↓ (matches `web.local` + `/`)
[next-service:80]
     ↓ (targetPort 3000)
[next-container running Next.js]
```

