```bash
ubuntu@judge0-vm:~/AlgoForge/judge0$ helm install nginx-ingress ingress-nginx/ingress-nginx \
>   --namespace ingress-nginx --create-namespace \
>   --set controller.service.type=NodePort \
>   --set controller.service.nodePorts.http=30080 \
>   --set controller.service.nodePorts.https=30443
NAME: nginx-ingress
LAST DEPLOYED: Sun Jun 22 12:23:51 2025
NAMESPACE: ingress-nginx
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
The ingress-nginx controller has been installed.
Get the application URL by running these commands:
  export HTTP_NODE_PORT=30080
  export HTTPS_NODE_PORT=30443
  export NODE_IP="$(kubectl get nodes --output jsonpath="{.items[0].status.addresses[1].address}")"

  echo "Visit http://${NODE_IP}:${HTTP_NODE_PORT} to access your application via HTTP."
  echo "Visit https://${NODE_IP}:${HTTPS_NODE_PORT} to access your application via HTTPS."

An example Ingress that makes use of the controller:
  apiVersion: networking.k8s.io/v1
  kind: Ingress
  metadata:
    name: example
    namespace: foo
  spec:
    ingressClassName: nginx
    rules:
      - host: www.example.com
        http:
          paths:
            - pathType: Prefix
              backend:
                service:
                  name: exampleService
                  port:
                    number: 80
              path: /
    # This section is only required if TLS is to be enabled for the Ingress
    tls:
      - hosts:
        - www.example.com
        secretName: example-tls

If TLS is enabled for the Ingress, a Secret containing the certificate and key must also be provided:

  apiVersion: v1
  kind: Secret
  metadata:
    name: example-tls
    namespace: foo
  data:
    tls.crt: <base64 encoded cert>
    tls.key: <base64 encoded key>
  type: kubernetes.io/tls

```

---
```bash
ubuntu@judge0-vm:~/AlgoForge/judge0$ kubectl get pods -n ingress-nginx
NAME                                                      READY   STATUS    RESTARTS   AGE
nginx-ingress-ingress-nginx-controller-7864cdfd94-pvgpm   1/1     Running   0          3m45s

ubuntu@judge0-vm:~/AlgoForge/judge0$ kubectl get svc -n ingress-nginx
NAME                                               TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)                      AGE
nginx-ingress-ingress-nginx-controller             NodePort    10.96.125.218   <none>        80:30080/TCP,443:30443/TCP   4m11s
nginx-ingress-ingress-nginx-controller-admission   ClusterIP   10.96.248.164   <none>        443/TCP                      4m11s
ubuntu@judge0-vm:~/AlgoForge/judge0$ kubectl get deployments -n ingress-nginx
NAME                                     READY   UP-TO-DATE   AVAILABLE   AGE
nginx-ingress-ingress-nginx-controller   1/1     1            1           4m25s

```